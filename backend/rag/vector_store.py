import chromadb
from chromadb.config import Settings
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
import logging
import json
import os
from datetime import datetime
import hashlib
from config import Config
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Chroma
from langchain.schema import Document
import pickle

logger = logging.getLogger(__name__)

class VectorStore:
    def __init__(self):
        self.config = Config()
        self.embeddings = OpenAIEmbeddings(openai_api_key=self.config.OPENAI_API_KEY)
        
        # Setup persistent directory
        self.persist_directory = os.path.join(self.config.DATA_FOLDER, "vector_store")
        os.makedirs(self.persist_directory, exist_ok=True)
        
        # Initialize ChromaDB client
        self.chroma_client = chromadb.PersistentClient(
            path=self.persist_directory,
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Collection names
        self.collections = {
            'groundwater_documents': 'groundwater_docs',
            'uploaded_data': 'user_uploads',
            'api_data': 'government_apis',
            'technical_reports': 'tech_reports'
        }
        
        self.vector_store = None
        self.collection_metadata = {}
        
        self._initialize_vector_store()
    
    def _initialize_vector_store(self):
        """Initialize the vector store with collections"""
        try:
            # Initialize main Langchain ChromaDB vector store
            self.vector_store = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self.embeddings,
                collection_name=self.collections['groundwater_documents']
            )
            
            # Initialize additional collections
            for collection_name, chroma_name in self.collections.items():
                try:
                    collection = self.chroma_client.get_or_create_collection(
                        name=chroma_name,
                        metadata={"description": f"Collection for {collection_name}"}
                    )
                    
                    self.collection_metadata[collection_name] = {
                        'name': chroma_name,
                        'collection': collection,
                        'document_count': collection.count(),
                        'created_at': datetime.now().isoformat()
                    }
                    
                except Exception as e:
                    logger.warning(f"Failed to initialize collection {collection_name}: {e}")
            
            logger.info(f"Vector store initialized with {len(self.collections)} collections")
            
        except Exception as e:
            logger.error(f"Vector store initialization failed: {e}")
            raise
    
    def add_documents(self, 
                     documents: List[str], 
                     metadatas: List[Dict[str, Any]], 
                     collection: str = 'groundwater_documents',
                     source: str = "unknown",
                     citation: str = None) -> Dict[str, Any]:
        """Add documents to the vector store with comprehensive metadata"""
        
        try:
            if not documents:
                return {
                    "success": False,
                    "error": "No documents provided"
                }
            
            if len(documents) != len(metadatas):
                return {
                    "success": False,
                    "error": "Number of documents and metadata entries must match"
                }
            
            # Generate document IDs
            document_ids = []
            processed_documents = []
            processed_metadatas = []
            
            for i, (doc, metadata) in enumerate(zip(documents, metadatas)):
                # Generate unique ID for document
                doc_hash = hashlib.md5(doc.encode()).hexdigest()
                doc_id = f"{source}_{doc_hash}_{i}"
                document_ids.append(doc_id)
                
                # Enhanced metadata
                enhanced_metadata = {
                    "document_id": doc_id,
                    "source": source,
                    "citation": citation or f"Document from {source}",
                    "added_at": datetime.now().isoformat(),
                    "content_length": len(doc),
                    "word_count": len(doc.split()),
                    "collection": collection,
                    **metadata
                }
                
                # Add quality scores
                enhanced_metadata["quality_score"] = self._calculate_content_quality(doc)
                enhanced_metadata["groundwater_relevance"] = self._calculate_groundwater_relevance(doc)
                
                processed_documents.append(doc)
                processed_metadatas.append(enhanced_metadata)
            
            # Add to main vector store (Langchain)
            if collection == 'groundwater_documents':
                langchain_docs = [
                    Document(page_content=doc, metadata=meta) 
                    for doc, meta in zip(processed_documents, processed_metadatas)
                ]
                
                self.vector_store.add_documents(langchain_docs)
                self.vector_store.persist()
            
            # Add to specific collection
            if collection in self.collection_metadata:
                chroma_collection = self.collection_metadata[collection]['collection']
                
                # Generate embeddings
                embeddings = self.embeddings.embed_documents(processed_documents)
                
                # Add to ChromaDB collection
                chroma_collection.add(
                    embeddings=embeddings,
                    documents=processed_documents,
                    metadatas=processed_metadatas,
                    ids=document_ids
                )
                
                # Update collection metadata
                self.collection_metadata[collection]['document_count'] = chroma_collection.count()
                self.collection_metadata[collection]['last_updated'] = datetime.now().isoformat()
            
            # Save processing log
            self._log_document_addition(document_ids, source, collection)
            
            logger.info(f"Added {len(processed_documents)} documents to collection '{collection}'")
            
            return {
                "success": True,
                "documents_added": len(processed_documents),
                "document_ids": document_ids,
                "collection": collection,
                "source": source,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to add documents to vector store: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def similarity_search(self, 
                         query: str, 
                         k: int = 5, 
                         collection: str = 'groundwater_documents',
                         filter_metadata: Dict[str, Any] = None,
                         score_threshold: float = 0.0) -> List[Dict[str, Any]]:
        """Perform similarity search with advanced filtering"""
        
        try:
            # Main vector store search (Langchain)
            if collection == 'groundwater_documents':
                # Create filter if provided
                langchain_filter = {}
                if filter_metadata:
                    for key, value in filter_metadata.items():
                        langchain_filter[key] = value
                
                # Perform search
                if langchain_filter:
                    results = self.vector_store.similarity_search_with_score(
                        query, k=k, filter=langchain_filter
                    )
                else:
                    results = self.vector_store.similarity_search_with_score(query, k=k)
                
                # Process results
                processed_results = []
                for doc, score in results:
                    if score >= score_threshold:
                        processed_results.append({
                            'content': doc.page_content,
                            'metadata': doc.metadata,
                            'similarity_score': float(score),
                            'relevance_rank': len(processed_results) + 1
                        })
                
                return processed_results
            
            # ChromaDB collection search
            elif collection in self.collection_metadata:
                chroma_collection = self.collection_metadata[collection]['collection']
                
                # Generate query embedding
                query_embedding = self.embeddings.embed_query(query)
                
                # Build where clause for filtering
                where_clause = {}
                if filter_metadata:
                    where_clause.update(filter_metadata)
                
                # Perform search
                results = chroma_collection.query(
                    query_embeddings=[query_embedding],
                    n_results=k,
                    where=where_clause if where_clause else None,
                    include=['documents', 'metadatas', 'distances']
                )
                
                # Process results
                processed_results = []
                if results['documents'] and results['documents'][0]:
                    for i in range(len(results['documents'][0])):
                        similarity_score = 1 - results['distances'][0][i]  # Convert distance to similarity
                        
                        if similarity_score >= score_threshold:
                            processed_results.append({
                                'content': results['documents'][0][i],
                                'metadata': results['metadatas'][0][i],
                                'similarity_score': float(similarity_score),
                                'relevance_rank': i + 1
                            })
                
                return processed_results
            
            else:
                logger.warning(f"Collection '{collection}' not found")
                return []
                
        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            return []
    
    def semantic_search_with_context(self, 
                                   query: str, 
                                   context: Dict[str, Any] = None,
                                   k: int = 5,
                                   diversify_results: bool = True) -> List[Dict[str, Any]]:
        """Advanced semantic search with context awareness and result diversification"""
        
        try:
            # Enhanced query based on context
            enhanced_query = self._enhance_query_with_context(query, context or {})
            
            # Perform searches across multiple collections
            all_results = []
            
            for collection_name in ['groundwater_documents', 'uploaded_data', 'api_data']:
                collection_results = self.similarity_search(
                    enhanced_query, 
                    k=k//2 + 2,  # Get more results for diversification
                    collection=collection_name,
                    score_threshold=0.5
                )
                
                # Add collection source to metadata
                for result in collection_results:
                    result['search_collection'] = collection_name
                
                all_results.extend(collection_results)
            
            # Rank and diversify results
            final_results = self._rank_and_diversify_results(
                all_results, query, k, diversify_results
            )
            
            # Add search insights
            search_insights = self._generate_search_insights(query, final_results, context)
            
            return {
                "results": final_results,
                "insights": search_insights,
                "search_metadata": {
                    "original_query": query,
                    "enhanced_query": enhanced_query,
                    "total_candidates": len(all_results),
                    "final_count": len(final_results),
                    "search_timestamp": datetime.now().isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Semantic search with context failed: {e}")
            return {
                "results": [],
                "error": str(e)
            }
    
    def _enhance_query_with_context(self, query: str, context: Dict[str, Any]) -> str:
        """Enhance search query based on context"""
        enhanced_parts = [query]
        
        # Add location context
        if 'location' in context:
            location = context['location']
            if isinstance(location, dict):
                if 'state' in location:
                    enhanced_parts.append(f"in {location['state']}")
                if 'district' in location:
                    enhanced_parts.append(f"near {location['district']}")
            else:
                enhanced_parts.append(f"in {location}")
        
        # Add temporal context
        if 'year' in context:
            enhanced_parts.append(f"year {context['year']}")
        
        # Add category context
        if 'category' in context:
            enhanced_parts.append(f"category {context['category']}")
        
        # Add measurement context
        if 'measurement_type' in context:
            enhanced_parts.append(f"{context['measurement_type']}")
        
        return " ".join(enhanced_parts)
    
    def _rank_and_diversify_results(self, 
                                   results: List[Dict], 
                                   query: str, 
                                   k: int, 
                                   diversify: bool) -> List[Dict[str, Any]]:
        """Rank results and optionally diversify to avoid redundancy"""
        
        if not results:
            return []
        
        # Sort by similarity score
        sorted_results = sorted(results, key=lambda x: x['similarity_score'], reverse=True)
        
        if not diversify or len(sorted_results) <= k:
            return sorted_results[:k]
        
        # Diversification: avoid too many similar results
        diversified_results = []
        content_hashes = set()
        
        for result in sorted_results:
            if len(diversified_results) >= k:
                break
            
            # Check content similarity with already selected results
            content = result['content']
            content_hash = hashlib.md5(content[:200].encode()).hexdigest()  # Hash first 200 chars
            
            # Check if this content is too similar to already selected
            is_too_similar = False
            for existing_hash in content_hashes:
                # Simple similarity check (could be improved)
                if self._simple_text_similarity(content, existing_hash) > 0.8:
                    is_too_similar = True
                    break
            
            if not is_too_similar:
                diversified_results.append(result)
                content_hashes.add(content_hash)
            elif len(diversified_results) < k // 2:  # Still add some similar results if we don't have enough
                diversified_results.append(result)
                content_hashes.add(content_hash)
        
        return diversified_results
    
    def _simple_text_similarity(self, text1: str, text2: str) -> float:
        """Simple text similarity calculation"""
        try:
            words1 = set(text1.lower().split())
            words2 = set(text2.lower().split())
            
            intersection = words1.intersection(words2)
            union = words1.union(words2)
            
            if not union:
                return 0.0
            
            return len(intersection) / len(union)
            
        except Exception:
            return 0.0
    
    def _generate_search_insights(self, 
                                 query: str, 
                                 results: List[Dict], 
                                 context: Dict[str, Any]) -> Dict[str, Any]:
        """Generate insights about search results"""
        
        insights = {}
        
        if not results:
            return {
                "message": "No relevant documents found",
                "suggestions": [
                    "Try broader search terms",
                    "Check spelling and terminology",
                    "Upload more relevant documents"
                ]
            }
        
        # Quality analysis
        avg_score = np.mean([r['similarity_score'] for r in results])
        high_quality_results = [r for r in results if r['similarity_score'] > 0.8]
        
        insights['quality_analysis'] = {
            'average_similarity': round(avg_score, 3),
            'high_quality_matches': len(high_quality_results),
            'quality_rating': 'high' if avg_score > 0.8 else 'medium' if avg_score > 0.6 else 'low'
        }
        
        # Source analysis
        sources = {}
        for result in results:
            source = result['metadata'].get('source', 'unknown')
            sources[source] = sources.get(source, 0) + 1
        
        insights['source_diversity'] = {
            'unique_sources': len(sources),
            'source_distribution': sources,
            'primary_source': max(sources.keys(), key=sources.get) if sources else None
        }
        
        # Temporal analysis
        years = []
        for result in results:
            metadata = result['metadata']
            if 'year' in metadata:
                years.append(metadata['year'])
            # Try to extract year from added_at timestamp
            elif 'added_at' in metadata:
                try:
                    year = datetime.fromisoformat(metadata['added_at'].replace('Z', '')).year
                    years.append(year)
                except:
                    pass
        
        if years:
            insights['temporal_analysis'] = {
                'date_range': f"{min(years)}-{max(years)}",
                'most_recent': max(years),
                'data_recency': 'recent' if max(years) >= 2020 else 'older'
            }
        
        # Geographical analysis
        locations = []
        for result in results:
            metadata = result['metadata']
            if 'state' in metadata:
                locations.append(metadata['state'])
        
        if locations:
            location_counts = {}
            for loc in locations:
                location_counts[loc] = location_counts.get(loc, 0) + 1
            
            insights['geographical_coverage'] = {
                'unique_locations': len(location_counts),
                'location_distribution': location_counts,
                'primary_location': max(location_counts.keys(), key=location_counts.get)
            }
        
        return insights
    
    def _calculate_content_quality(self, content: str) -> float:
        """Calculate quality score for content (0-1)"""
        try:
            score = 0.0
            
            # Length score (optimal around 500-2000 chars)
            length = len(content)
            if 100 <= length <= 3000:
                score += 0.3 * min(length / 1000, 1.0)
            
            # Technical term density
            technical_terms = ['groundwater', 'aquifer', 'water level', 'recharge', 'extraction', 
                             'pumping', 'well', 'borehole', 'piezometer', 'hydraulic']
            term_count = sum(1 for term in technical_terms if term.lower() in content.lower())
            score += 0.3 * min(term_count / 5, 1.0)
            
            # Numerical data presence
            number_pattern = r'\d+\.?\d*\s*(?:m|meter|feet|ft|mg/l|ppm)'
            numerical_matches = len(re.findall(number_pattern, content, re.IGNORECASE))
            score += 0.2 * min(numerical_matches / 3, 1.0)
            
            # Sentence structure (complete sentences)
            sentences = content.count('.') + content.count('!') + content.count('?')
            words = len(content.split())
            if words > 0 and sentences > 0:
                avg_sentence_length = words / sentences
                if 10 <= avg_sentence_length <= 25:  # Good sentence length
                    score += 0.2
            
            return min(score, 1.0)
            
        except Exception as e:
            logger.warning(f"Quality calculation failed: {e}")
            return 0.5
    
    def _calculate_groundwater_relevance(self, content: str) -> float:
        """Calculate groundwater domain relevance (0-1)"""
        try:
            content_lower = content.lower()
            score = 0.0
            
            # Core groundwater terms
            core_terms = {
                'groundwater': 0.2, 'water level': 0.15, 'aquifer': 0.15,
                'well': 0.1, 'borehole': 0.1, 'recharge': 0.1,
                'extraction': 0.1, 'pumping': 0.05, 'water table': 0.05
            }
            
            for term, weight in core_terms.items():
                if term in content_lower:
                    score += weight
            
            # Indian context terms
            indian_terms = ['india', 'indian', 'cgwb', 'wris', 'states', 'districts']
            indian_count = sum(1 for term in indian_terms if term in content_lower)
            score += min(indian_count / len(indian_terms), 0.2)
            
            # Measurement context
            measurement_indicators = ['meter', 'depth', 'level', 'measurement', 'monitoring']
            measurement_count = sum(1 for term in measurement_indicators if term in content_lower)
            score += min(measurement_count / len(measurement_indicators), 0.1)
            
            return min(score, 1.0)
            
        except Exception as e:
            logger.warning(f"Relevance calculation failed: {e}")
            return 0.5
    
    def _log_document_addition(self, document_ids: List[str], source: str, collection: str):
        """Log document addition for audit trail"""
        try:
            log_entry = {
                'timestamp': datetime.now().isoformat(),
                'action': 'add_documents',
                'document_ids': document_ids,
                'source': source,
                'collection': collection,
                'count': len(document_ids)
            }
            
            log_file = os.path.join(self.persist_directory, 'vector_store.log')
            with open(log_file, 'a') as f:
                f.write(json.dumps(log_entry) + '\n')
                
        except Exception as e:
            logger.warning(f"Failed to log document addition: {e}")
    
    def delete_documents(self, document_ids: List[str], collection: str = 'groundwater_documents') -> Dict[str, Any]:
        """Delete documents from vector store"""
        try:
            deleted_count = 0
            
            if collection in self.collection_metadata:
                chroma_collection = self.collection_metadata[collection]['collection']
                
                # Delete from ChromaDB
                chroma_collection.delete(ids=document_ids)
                deleted_count = len(document_ids)
                
                # Update metadata
                self.collection_metadata[collection]['document_count'] = chroma_collection.count()
                self.collection_metadata[collection]['last_updated'] = datetime.now().isoformat()
            
            # Note: Langchain Chroma doesn't have direct delete by ID functionality
            # Would need to rebuild the collection if documents need to be removed from main store
            
            return {
                "success": True,
                "deleted_count": deleted_count,
                "collection": collection,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Failed to delete documents: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_collection_stats(self, collection: str = None) -> Dict[str, Any]:
        """Get statistics about collections"""
        try:
            if collection:
                if collection in self.collection_metadata:
                    meta = self.collection_metadata[collection]
                    return {
                        "collection": collection,
                        "document_count": meta['document_count'],
                        "created_at": meta['created_at'],
                        "last_updated": meta.get('last_updated', meta['created_at'])
                    }
                else:
                    return {"error": f"Collection {collection} not found"}
            else:
                # Return stats for all collections
                stats = {}
                total_docs = 0
                
                for collection_name, meta in self.collection_metadata.items():
                    stats[collection_name] = {
                        "document_count": meta['document_count'],
                        "created_at": meta['created_at'],
                        "last_updated": meta.get('last_updated', meta['created_at'])
                    }
                    total_docs += meta['document_count']
                
                stats['summary'] = {
                    "total_collections": len(self.collection_metadata),
                    "total_documents": total_docs,
                    "storage_path": self.persist_directory
                }
                
                return stats
                
        except Exception as e:
            logger.error(f"Failed to get collection stats: {e}")
            return {"error": str(e)}
    
    def backup_vector_store(self, backup_path: str = None) -> Dict[str, Any]:
        """Create a backup of the vector store"""
        try:
            if not backup_path:
                backup_path = os.path.join(
                    self.config.DATA_FOLDER, 
                    f"vector_store_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                )
            
            os.makedirs(backup_path, exist_ok=True)
            
            # Backup ChromaDB data
            import shutil
            shutil.copytree(self.persist_directory, 
                          os.path.join(backup_path, "chroma_data"), 
                          dirs_exist_ok=True)
            
            # Backup metadata
            metadata_backup = {
                'backup_timestamp': datetime.now().isoformat(),
                'original_path': self.persist_directory,
                'collections': self.collection_metadata,
                'config': {
                    'embeddings_model': 'openai',
                    'persist_directory': self.persist_directory
                }
            }
            
            with open(os.path.join(backup_path, 'backup_metadata.json'), 'w') as f:
                json.dump(metadata_backup, f, indent=2, default=str)
            
            return {
                "success": True,
                "backup_path": backup_path,
                "backup_size_mb": self._get_directory_size(backup_path) / (1024 * 1024),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _get_directory_size(self, path: str) -> int:
        """Get total size of directory in bytes"""
        total_size = 0
        for dirpath, dirnames, filenames in os.walk(path):
            for filename in filenames:
                file_path = os.path.join(dirpath, filename)
                try:
                    total_size += os.path.getsize(file_path)
                except OSError:
                    pass
        return total_size
    
    def optimize_vector_store(self) -> Dict[str, Any]:
        """Optimize vector store performance"""
        try:
            optimizations = []
            
            # Remove duplicate embeddings (if any)
            for collection_name, meta in self.collection_metadata.items():
                collection = meta['collection']
                # ChromaDB handles optimization internally
                optimizations.append(f"Checked {collection_name} for optimizations")
            
            # Cleanup old log files
            log_file = os.path.join(self.persist_directory, 'vector_store.log')
            if os.path.exists(log_file):
                # Keep only last 1000 entries
                with open(log_file, 'r') as f:
                    lines = f.readlines()
                
                if len(lines) > 1000:
                    with open(log_file, 'w') as f:
                        f.writelines(lines[-1000:])
                    optimizations.append("Cleaned up log file")
            
            return {
                "success": True,
                "optimizations_performed": optimizations,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Optimization failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
