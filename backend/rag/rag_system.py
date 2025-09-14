from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.vectorstores import Chroma
from langchain.embeddings import OpenAIEmbeddings
from langchain.chat_models import ChatOpenAI
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain.memory import ConversationBufferMemory
from langchain.schema import Document
import chromadb
from config import Config
import logging
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List
import threading
import time


class INGRESRAGSystem:
    def __init__(self):
        self.config = Config()
        self.embeddings = OpenAIEmbeddings(openai_api_key=self.config.OPENAI_API_KEY)
        self.llm = ChatOpenAI(
            temperature=0.1,  # Low temperature for factual responses
            model_name=getattr(self.config, 'OPENAI_MODEL', "gpt-4"),
            openai_api_key=self.config.OPENAI_API_KEY,
            max_tokens=1000,  # Reasonable response length
            request_timeout=60  # 60 second timeout
        )
        self.vector_store = None
        self.qa_chain = None
        self.conversation_memories = {}  # Session-based memory storage
        self.memory_timestamps = {}  # Track creation time of memories
        self.default_memory = None
        
        # Performance monitoring
        self.query_count = 0
        self.last_cleanup = datetime.now()
        self.cleanup_interval_hours = getattr(self.config, 'CONVERSATION_MEMORY_TTL_HOURS', 24)
        
        # Thread lock for memory operations
        self._memory_lock = threading.Lock()
        
        # Initialize components
        self.setup_vector_store()
        self.setup_qa_chain()
        
        # Start background cleanup task
        self._start_cleanup_scheduler()
        
        logging.info("INGRES RAG System initialized with advanced memory management")
    
    def setup_vector_store(self):
        """Initialize ChromaDB vector store with persistence and optimization"""
        try:
            persist_directory = os.path.join(self.config.DATA_FOLDER, "chroma_db")
            os.makedirs(persist_directory, exist_ok=True)
            
            # Enhanced ChromaDB settings for better performance
            self.vector_store = Chroma(
                persist_directory=persist_directory,
                embedding_function=self.embeddings,
                collection_name="ingres_groundwater_documents",
                collection_metadata={
                    "hnsw:space": "cosine",  # Cosine similarity for better text matching
                    "hnsw:construction_ef": 200,  # Higher ef for better recall
                    "hnsw:M": 16  # Good balance of speed and accuracy
                }
            )
            
            logging.info("Vector store initialized with optimized settings")
            
        except Exception as e:
            logging.error(f"Failed to setup vector store: {e}")
            raise
    
    def setup_qa_chain(self):
        """Setup RAG chain with comprehensive groundwater domain prompt"""
        groundwater_expert_prompt = PromptTemplate(
            input_variables=["context", "question", "chat_history"],
            template="""You are Dr. INGRES, an expert AI assistant specializing in Indian groundwater and water resource data from the INGRES (India Groundwater Resource Estimation System) and CGWB (Central Ground Water Board) databases.

EXPERTISE AREAS:
- Groundwater levels, quality, and resource assessment
- Water extraction rates and sustainability categories
- District/state-wise groundwater management
- CGWB guidelines and Indian water policies
- Hydrogeological conditions and aquifer systems

CONTEXT INFORMATION:
{context}

CONVERSATION HISTORY:
{chat_history}

CURRENT QUESTION: {question}

CRITICAL INSTRUCTIONS:
1. **NO HALLUCINATION**: Only provide information that can be verified from the context or established groundwater science
2. **EXACT NUMBERS**: When providing statistics, use exact values from the context with proper units
3. **CLEAR CITATIONS**: Always mention the data source (e.g., "According to CGWB data..." or "Based on the uploaded dataset...")
4. **UNIQUE IDs**: Use unique district/taluk identifiers when available to avoid location confusion
5. **Indian Context**: All responses should be relevant to Indian groundwater conditions and standards
6. **Technical Accuracy**: Explain technical terms but maintain scientific accuracy
7. **Data Limitations**: If information is not available, clearly state "This specific information is not available in the current dataset"

RESPONSE STRUCTURE:
- Direct answer to the question
- Supporting data with exact numbers and units
- Data source citation
- Context for non-experts (if technical)
- Practical implications or recommendations (if relevant)

GROUNDWATER CATEGORIES (India):
- Safe: ≤70% of annual recharge extracted
- Semi-Critical: 70-90% extraction
- Critical: 90-100% extraction  
- Over-Exploited: >100% extraction

Remember: You are providing information that may influence water management decisions. Accuracy and transparency are paramount.

RESPONSE:"""
        )
        
        # Create default memory for maintaining conversation context
        self.default_memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True,
            max_token_limit=2000  # Limit memory to prevent token overflow
        )
        
        self.qa_chain = RetrievalQA.from_chain_type(
            llm=self.llm,
            chain_type="stuff",
            retriever=self.vector_store.as_retriever(
                search_type="similarity_score_threshold",
                search_kwargs={
                    "k": 5,  # Retrieve top 5 most relevant documents
                    "score_threshold": 0.6,  # Minimum similarity threshold
                    "fetch_k": 20  # Fetch more candidates for better filtering
                }
            ),
            chain_type_kwargs={
                "prompt": groundwater_expert_prompt,
                "memory": self.default_memory,
                "verbose": False  # Disable verbose logging for production
            },
            return_source_documents=True
        )
        
        logging.info("QA chain setup completed with groundwater expertise")
    
    def get_or_create_memory(self, session_id: str) -> ConversationBufferMemory:
        """Get or create conversation memory for a session with timestamp tracking"""
        with self._memory_lock:  # Thread-safe memory operations
            if session_id and session_id not in self.conversation_memories:
                self.conversation_memories[session_id] = ConversationBufferMemory(
                    memory_key="chat_history",
                    return_messages=True,
                    max_token_limit=2000
                )
                # Track creation time for cleanup
                self.memory_timestamps[session_id] = datetime.now()
                
                logging.debug(f"Created new memory for session: {session_id}")
            
            return self.conversation_memories.get(session_id, self.default_memory)
    
    def cleanup_old_memories(self, max_age_hours: int = None):
        """Clean up old conversation memories to prevent memory leaks"""
        if max_age_hours is None:
            max_age_hours = self.cleanup_interval_hours
        
        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
        old_sessions = []
        
        with self._memory_lock:
            # Find old sessions
            for session_id, timestamp in self.memory_timestamps.items():
                if timestamp < cutoff_time:
                    old_sessions.append(session_id)
            
            # Clean up old sessions
            for session_id in old_sessions:
                if session_id in self.conversation_memories:
                    del self.conversation_memories[session_id]
                if session_id in self.memory_timestamps:
                    del self.memory_timestamps[session_id]
        
        if old_sessions:
            logging.info(f"Cleaned up {len(old_sessions)} old conversation memories (>{max_age_hours}h old)")
        
        # Update last cleanup time
        self.last_cleanup = datetime.now()
        
        return len(old_sessions)
    
    def _start_cleanup_scheduler(self):
        """Start background thread for automatic memory cleanup"""
        def cleanup_worker():
            while True:
                try:
                    # Sleep for cleanup interval
                    time.sleep(self.cleanup_interval_hours * 3600)  # Convert hours to seconds
                    
                    # Perform cleanup
                    self.cleanup_old_memories()
                    
                except Exception as e:
                    logging.error(f"Memory cleanup scheduler error: {e}")
        
        # Start daemon thread (won't prevent program exit)
        cleanup_thread = threading.Thread(target=cleanup_worker, daemon=True)
        cleanup_thread.start()
        
        logging.info(f"Started automatic memory cleanup scheduler (every {self.cleanup_interval_hours}h)")
    
    def add_documents_to_vector_store(self, documents: List[str], source_type: str, citation: str) -> bool:
        """Add documents to vector store with comprehensive metadata and optimization"""
        try:
            chunk_size = getattr(self.config, 'RAG_CHUNK_SIZE', 1000)
            chunk_overlap = getattr(self.config, 'RAG_CHUNK_OVERLAP', 200)
            
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""],
                length_function=len
            )
            
            processed_documents = []
            
            for i, doc_content in enumerate(documents):
                if isinstance(doc_content, dict):
                    # Convert structured data to narrative text
                    text_content = self._dict_to_narrative(doc_content)
                else:
                    text_content = str(doc_content)
                
                # Split into chunks
                chunks = text_splitter.split_text(text_content)
                
                for j, chunk in enumerate(chunks):
                    # Enhanced metadata for better retrieval
                    metadata = {
                        "source": source_type,
                        "citation": citation,
                        "chunk_id": f"{i}_{j}",
                        "document_type": "groundwater_data",
                        "timestamp": datetime.now().isoformat(),
                        "chunk_length": len(chunk),
                        "word_count": len(chunk.split()),
                        # Extract key entities for better search
                        "contains_numbers": any(char.isdigit() for char in chunk),
                        "contains_locations": self._contains_indian_locations(chunk),
                        "data_category": self._categorize_content(chunk),
                        "quality_score": self._calculate_chunk_quality(chunk)
                    }
                    
                    doc = Document(page_content=chunk, metadata=metadata)
                    processed_documents.append(doc)
            
            # Add to vector store in batches for better performance
            batch_size = 100
            for i in range(0, len(processed_documents), batch_size):
                batch = processed_documents[i:i + batch_size]
                self.vector_store.add_documents(batch)
            
            # Persist changes
            self.vector_store.persist()
            
            logging.info(f"Added {len(processed_documents)} document chunks to vector store from {source_type}")
            return True
            
        except Exception as e:
            logging.error(f"Failed to add documents to vector store: {e}")
            return False
    
    def _calculate_chunk_quality(self, chunk: str) -> float:
        """Calculate quality score for a document chunk"""
        score = 0.0
        
        # Length scoring (optimal range 200-800 characters)
        length = len(chunk)
        if 200 <= length <= 800:
            score += 0.3
        elif 100 <= length <= 1000:
            score += 0.2
        
        # Information density
        words = chunk.split()
        if len(words) > 0:
            # Technical terms density
            technical_terms = ['groundwater', 'aquifer', 'water level', 'extraction', 'recharge', 
                             'contamination', 'quality', 'depth', 'well', 'borehole']
            tech_density = sum(1 for word in words if word.lower() in technical_terms) / len(words)
            score += min(tech_density * 0.4, 0.2)
            
            # Numbers and measurements
            numeric_density = sum(1 for word in words if any(char.isdigit() for char in word)) / len(words)
            score += min(numeric_density * 0.3, 0.15)
        
        # Location information
        if self._contains_indian_locations(chunk):
            score += 0.1
        
        # Complete sentences
        sentence_endings = chunk.count('.') + chunk.count('!') + chunk.count('?')
        if sentence_endings > 0:
            score += 0.05
        
        return min(score, 1.0)
    
    def _dict_to_narrative(self, data_dict: dict) -> str:
        """Convert dictionary data to narrative text for better RAG performance"""
        narrative_parts = []
        
        # Location information
        if 'state' in data_dict and 'district' in data_dict:
            location = f"{data_dict['district']} district in {data_dict['state']} state"
            narrative_parts.append(f"This groundwater data is from {location}")
        
        # Water level information
        if 'water_level' in data_dict:
            level = data_dict['water_level']
            if level is not None:
                narrative_parts.append(f"The groundwater level is measured at {level} meters below ground level")
        
        # Temporal information
        if 'year' in data_dict:
            year = data_dict['year']
            month_text = ""
            if 'month' in data_dict and data_dict['month']:
                months = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                         'July', 'August', 'September', 'October', 'November', 'December']
                try:
                    month_num = int(data_dict['month'])
                    if 1 <= month_num <= 12:
                        month_text = f" in {months[month_num]}"
                except (ValueError, IndexError):
                    pass
            narrative_parts.append(f"This measurement was recorded in {year}{month_text}")
        
        # Category information with detailed explanations
        if 'category' in data_dict:
            category = data_dict['category']
            category_explanations = {
                'Safe': 'indicating sustainable groundwater usage with extraction below 70% of annual recharge',
                'Semi-Critical': 'indicating moderate stress with extraction between 70-90% of annual recharge',
                'Critical': 'indicating high stress with extraction between 90-100% of annual recharge',
                'Over-Exploited': 'indicating unsustainable usage with extraction exceeding 100% of annual recharge'
            }
            explanation = category_explanations.get(category, 'with unspecified extraction levels')
            narrative_parts.append(f"The groundwater status is classified as {category}, {explanation}")
        
        # Spatial information
        if 'latitude' in data_dict and 'longitude' in data_dict:
            lat, lon = data_dict['latitude'], data_dict['longitude']
            if lat and lon:
                try:
                    lat_float, lon_float = float(lat), float(lon)
                    narrative_parts.append(f"The geographic coordinates are {lat_float:.4f}°N, {lon_float:.4f}°E")
                except (ValueError, TypeError):
                    pass
        
        # Unique identifiers
        if 'unique_district_id' in data_dict:
            narrative_parts.append(f"The unique district identifier is {data_dict['unique_district_id']}")
        
        # Additional water quality parameters if present
        quality_params = ['ph', 'tds', 'fluoride', 'arsenic', 'nitrate']
        for param in quality_params:
            if param in data_dict and data_dict[param] is not None:
                try:
                    value = float(data_dict[param])
                    unit = 'mg/L' if param != 'ph' else ''
                    narrative_parts.append(f"The {param.upper()} level is {value} {unit}".strip())
                except (ValueError, TypeError):
                    pass
        
        result = ". ".join(narrative_parts)
        if result and not result.endswith('.'):
            result += "."
        
        return result
    
    def _contains_indian_locations(self, text: str) -> bool:
        """Check if text contains Indian location names"""
        indian_states = [
            'andhra pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa', 'gujarat',
            'haryana', 'himachal pradesh', 'jharkhand', 'karnataka', 'kerala',
            'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram',
            'nagaland', 'odisha', 'orissa', 'punjab', 'rajasthan', 'sikkim', 
            'tamil nadu', 'telangana', 'tripura', 'uttar pradesh', 'uttarakhand', 
            'west bengal', 'delhi', 'mumbai', 'bangalore', 'chennai', 'kolkata',
            'hyderabad', 'pune', 'ahmedabad', 'jaipur', 'lucknow', 'kanpur'
        ]
        
        text_lower = text.lower()
        return any(location in text_lower for location in indian_states)
    
    def _categorize_content(self, text: str) -> str:
        """Categorize content type for better retrieval"""
        text_lower = text.lower()
        
        # Category keywords mapping
        category_keywords = {
            'water_level_data': ['water level', 'depth', 'meter', 'feet', 'bgl', 'mbgl', 'groundwater level'],
            'water_quality_data': ['quality', 'contamination', 'ph', 'tds', 'fluoride', 'arsenic', 'nitrate', 'chloride'],
            'resource_assessment': ['safe', 'critical', 'over-exploited', 'extraction', 'assessment', 'category', 'stage'],
            'predictive_analysis': ['prediction', 'forecast', 'trend', 'future', 'model', 'analysis'],
            'spatial_data': ['coordinates', 'latitude', 'longitude', 'location', 'district', 'state'],
            'temporal_data': ['year', 'month', 'season', 'time', 'period', 'annual', 'monthly']
        }
        
        scores = {}
        for category, keywords in category_keywords.items():
            score = sum(1 for keyword in keywords if keyword in text_lower)
            if score > 0:
                scores[category] = score
        
        if scores:
            return max(scores.items(), key=lambda x: x[1])[0]
        else:
            return 'general_information'
    
    def query(self, question: str, session_id: str = None) -> Dict[str, Any]:
        """Query the RAG system with enhanced error handling and response quality"""
        start_time = time.time()
        self.query_count += 1
        
        try:
            # Periodic cleanup check (every 100 queries or 6 hours)
            if (self.query_count % 100 == 0 or 
                (datetime.now() - self.last_cleanup).total_seconds() > 21600):
                self.cleanup_old_memories()
            
            # Get appropriate memory for session
            if session_id:
                memory = self.get_or_create_memory(session_id)
                # Update QA chain memory
                self.qa_chain.memory = memory
            
            # Enhance question with context if needed
            enhanced_question = self._enhance_question(question)
            
            # Get response from QA chain
            result = self.qa_chain({"query": enhanced_question})
            
            # Process and validate response
            response_analysis = self._analyze_response_quality(result, question)
            
            # Extract and process source documents
            sources = self._process_source_documents(result.get("source_documents", []))
            
            # Generate follow-up suggestions
            follow_ups = self._generate_intelligent_follow_ups(question, result["result"], sources)
            
            # Calculate response time
            response_time = time.time() - start_time
            
            response_data = {
                "success": True,
                "answer": result["result"],
                "sources": sources,
                "confidence": response_analysis["confidence"],
                "quality_metrics": response_analysis,
                "follow_up_suggestions": follow_ups,
                "session_id": session_id,
                "response_type": self._classify_response_type(result["result"]),
                "response_time_ms": round(response_time * 1000, 2),
                "timestamp": datetime.now().isoformat(),
                "query_id": self.query_count
            }
            
            # Update conversation memory
            if session_id and session_id in self.conversation_memories:
                with self._memory_lock:
                    self.conversation_memories[session_id].save_context(
                        {"input": question},
                        {"output": result["result"]}
                    )
                    # Update timestamp for this session
                    self.memory_timestamps[session_id] = datetime.now()
            
            logging.info(f"RAG query completed in {response_time:.2f}s (confidence: {response_analysis['confidence']:.2f})")
            return response_data
            
        except Exception as e:
            error_time = time.time() - start_time
            logging.error(f"RAG query failed after {error_time:.2f}s: {e}")
            return {
                "success": False,
                "error": str(e),
                "answer": "I apologize, but I encountered an error processing your question. Please try rephrasing it or check if you're asking about Indian groundwater data that I have access to.",
                "sources": [],
                "confidence": 0.0,
                "follow_up_suggestions": [
                    "Try asking about groundwater levels in a specific Indian state",
                    "Ask about water quality parameters in a district",
                    "Request information about CGWB groundwater categories",
                    "Upload CSV data to expand the knowledge base"
                ],
                "response_time_ms": round(error_time * 1000, 2),
                "timestamp": datetime.now().isoformat(),
                "query_id": self.query_count
            }
    
    def _enhance_question(self, question: str) -> str:
        """Enhance question with context for better retrieval"""
        # Add India context if not present
        india_terms = ['india', 'indian', 'cgwb', 'ingres', 'bihar', 'punjab', 'maharashtra', 
                       'gujarat', 'karnataka', 'tamil nadu', 'rajasthan', 'uttar pradesh']
        
        if not any(term in question.lower() for term in india_terms):
            question = f"In the context of Indian groundwater and CGWB data: {question}"
        
        # Add technical context for ambiguous terms
        if 'water level' in question.lower() and 'groundwater' not in question.lower():
            question = question.replace('water level', 'groundwater level')
        
        return question
    
    def _analyze_response_quality(self, result: dict, original_question: str) -> dict:
        """Analyze response quality and confidence with enhanced metrics"""
        answer = result["result"]
        source_docs = result.get("source_documents", [])
        
        # Basic quality metrics
        metrics = {
            "confidence": 0.5,  # Default confidence
            "has_sources": len(source_docs) > 0,
            "source_count": len(source_docs),
            "answer_length": len(answer.split()),
            "contains_numbers": any(char.isdigit() for char in answer),
            "contains_citations": any(term in answer.lower() for term in 
                                   ['according to', 'based on', 'cgwb', 'source', 'data shows']),
            "addresses_question": self._check_question_relevance(original_question, answer),
            "has_location_info": self._contains_indian_locations(answer),
            "technical_accuracy": self._assess_technical_accuracy(answer)
        }
        
        # Calculate confidence score with weighted factors
        confidence = 0.2  # Base confidence
        
        # Source-based confidence
        if metrics["has_sources"]:
            confidence += 0.2
            if metrics["source_count"] >= 3:
                confidence += 0.1
            if metrics["source_count"] >= 5:
                confidence += 0.05
        
        # Content quality confidence
        if metrics["contains_numbers"]:
            confidence += 0.15
        if metrics["contains_citations"]:
            confidence += 0.1
        if metrics["addresses_question"]:
            confidence += 0.2
        if metrics["has_location_info"]:
            confidence += 0.05
        if metrics["technical_accuracy"]:
            confidence += 0.1
        
        # Length-based confidence (optimal range)
        if 50 <= metrics["answer_length"] <= 300:
            confidence += 0.1
        elif 30 <= metrics["answer_length"] <= 500:
            confidence += 0.05
        
        metrics["confidence"] = min(0.95, confidence)  # Cap at 95%
        
        return metrics
    
    def _assess_technical_accuracy(self, answer: str) -> bool:
        """Assess technical accuracy of the response"""
        answer_lower = answer.lower()
        
        # Check for common technical indicators
        technical_indicators = [
            'meter', 'depth', 'extraction', 'recharge', 'aquifer', 'borehole',
            'groundwater', 'water table', 'precipitation', 'discharge'
        ]
        
        return any(indicator in answer_lower for indicator in technical_indicators)
    
    def _check_question_relevance(self, question: str, answer: str) -> bool:
        """Check if answer addresses the question with improved algorithm"""
        question_words = set(question.lower().split())
        answer_words = set(answer.lower().split())
        
        # Remove common words
        common_words = {
            'the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'in', 'of', 
            'for', 'with', 'by', 'this', 'that', 'are', 'was', 'were', 'be',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'can', 'shall', 'must'
        }
        question_words -= common_words
        answer_words -= common_words
        
        if not question_words:
            return False
        
        # Check overlap with higher threshold
        overlap = len(question_words.intersection(answer_words))
        overlap_ratio = overlap / len(question_words)
        
        return overlap_ratio >= 0.2  # At least 20% word overlap
    
    def _process_source_documents(self, source_docs: List) -> List[dict]:
        """Process source documents for response with enhanced information"""
        sources = []
        
        for i, doc in enumerate(source_docs[:5]):  # Limit to top 5 sources
            source_info = {
                "source_id": i + 1,
                "source_type": doc.metadata.get("source", "Unknown"),
                "citation": doc.metadata.get("citation", "No citation available"),
                "content_preview": (doc.page_content[:200] + "..." 
                                  if len(doc.page_content) > 200 
                                  else doc.page_content),
                "data_category": doc.metadata.get("data_category", "general"),
                "timestamp": doc.metadata.get("timestamp", "Unknown"),
                "quality_score": doc.metadata.get("quality_score", "N/A"),
                "chunk_id": doc.metadata.get("chunk_id", f"chunk_{i}"),
                "relevance_score": getattr(doc, 'score', 'N/A')
            }
            sources.append(source_info)
        
        return sources
    
    def _generate_intelligent_follow_ups(self, question: str, answer: str, sources: List[dict]) -> List[str]:
        """Generate intelligent follow-up questions based on context"""
        follow_ups = []
        
        question_lower = question.lower()
        answer_lower = answer.lower()
        
        # Location-based follow-ups
        if any(term in question_lower for term in ['state', 'district', 'region', 'area']):
            follow_ups.extend([
                "Show me a map visualization of this groundwater data",
                "How do these levels compare to neighboring regions?",
                "What are the seasonal trends for this area?",
                "Create a chart showing the water level trends"
            ])
        
        # Data-specific follow-ups
        if any(term in question_lower for term in ['water level', 'depth', 'groundwater']):
            follow_ups.extend([
                "What factors influence these water level changes?",
                "Can you predict future water levels for this location?",
                "Show me the historical trend analysis",
                "How does this compare to the national average?"
            ])
        
        # Quality-related follow-ups
        if any(term in question_lower for term in ['quality', 'contamination', 'ph', 'tds']):
            follow_ups.extend([
                "What are the potential contamination sources?",
                "How do these parameters compare to WHO standards?",
                "What treatment methods would you recommend?",
                "Show me the water quality trends over time"
            ])
        
        # Category-related follow-ups
        if any(cat in answer_lower for cat in ['safe', 'semi-critical', 'critical', 'over-exploited']):
            follow_ups.extend([
                "What management strategies are recommended for this category?",
                "How has this classification changed over the years?",
                "What are the policy implications of this status?",
                "Show me similar areas with the same classification"
            ])
        
        # Prediction-related follow-ups
        if any(term in question_lower for term in ['predict', 'forecast', 'future', 'trend']):
            follow_ups.extend([
                "What's the confidence level of this prediction?",
                "What factors could change this forecast?",
                "Show me the prediction model details",
                "How can this information be used for planning?"
            ])
        
        # Visualization follow-ups
        if any(term in answer_lower for term in ['data', 'records', 'measurements', 'statistics']):
            follow_ups.extend([
                "Create an interactive dashboard for this data",
                "Generate a comprehensive report with charts",
                "Export this analysis as a CSV file",
                "Show me the data distribution patterns"
            ])
        
        # Remove duplicates and limit to 4 suggestions
        follow_ups = list(dict.fromkeys(follow_ups))[:4]
        
        # If no specific follow-ups, provide general ones
        if not follow_ups:
            follow_ups = [
                "Show me more details about this data",
                "Create a visualization of this information",
                "How reliable is this data?",
                "What other related information is available?"
            ]
        
        return follow_ups
    
    def _classify_response_type(self, answer: str) -> str:
        """Classify the type of response for UI formatting"""
        answer_lower = answer.lower()
        
        if any(term in answer_lower for term in ['chart', 'graph', 'visualization', 'map', 'dashboard']):
            return 'visualization_response'
        elif any(term in answer_lower for term in ['prediction', 'forecast', 'future', 'predict']):
            return 'predictive_response'
        elif any(term in answer_lower for term in ['recommend', 'suggest', 'should', 'advise']):
            return 'recommendation_response'
        elif (any(char.isdigit() for char in answer) and 
              any(term in answer_lower for term in ['meter', 'level', 'percent', 'mg/l', 'value'])):
            return 'data_response'
        elif any(term in answer_lower for term in ['error', 'not available', 'insufficient', 'cannot']):
            return 'error_response'
        else:
            return 'general_response'
    
    def clear_session_memory(self, session_id: str) -> bool:
        """Clear conversation memory for a session"""
        try:
            with self._memory_lock:
                removed = False
                if session_id in self.conversation_memories:
                    del self.conversation_memories[session_id]
                    removed = True
                if session_id in self.memory_timestamps:
                    del self.memory_timestamps[session_id]
                    removed = True
                
                if removed:
                    logging.info(f"Cleared memory for session: {session_id}")
                
                return removed
        except Exception as e:
            logging.error(f"Failed to clear session memory for {session_id}: {e}")
            return False
    
    def get_vector_store_stats(self) -> Dict[str, Any]:
        """Get comprehensive statistics about the vector store"""
        try:
            collection = self.vector_store._collection
            
            # Get document categories
            category_stats = {}
            try:
                # This requires ChromaDB to support metadata queries
                all_metadata = collection.get(include=['metadatas'])
                if all_metadata and 'metadatas' in all_metadata:
                    for metadata in all_metadata['metadatas']:
                        category = metadata.get('data_category', 'unknown')
                        category_stats[category] = category_stats.get(category, 0) + 1
            except:
                category_stats = {"analysis_unavailable": "ChromaDB metadata query not supported"}
            
            return {
                "total_documents": collection.count(),
                "collection_name": collection.name,
                "category_distribution": category_stats,
                "last_updated": datetime.now().isoformat(),
                "memory_stats": {
                    "active_sessions": len(self.conversation_memories),
                    "total_queries": self.query_count,
                    "last_cleanup": self.last_cleanup.isoformat(),
                    "cleanup_interval_hours": self.cleanup_interval_hours
                }
            }
        except Exception as e:
            logging.error(f"Failed to get vector store stats: {e}")
            return {"error": str(e)}
    
    def get_system_health(self) -> Dict[str, Any]:
        """Get system health metrics"""
        try:
            return {
                "status": "healthy",
                "uptime_queries": self.query_count,
                "active_sessions": len(self.conversation_memories),
                "memory_usage_mb": len(str(self.conversation_memories)) / (1024 * 1024),
                "last_cleanup": self.last_cleanup.isoformat(),
                "vector_store_connected": self.vector_store is not None,
                "llm_connected": self.llm is not None,
                "qa_chain_ready": self.qa_chain is not None,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def __del__(self):
        """Cleanup when object is destroyed"""
        try:
            # Final cleanup of memories
            with self._memory_lock:
                self.conversation_memories.clear()
                self.memory_timestamps.clear()
        except:
            pass  # Ignore errors during cleanup
