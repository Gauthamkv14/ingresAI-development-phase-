from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional
import asyncio
import subprocess
import json
import os
import logging
from datetime import datetime

app = FastAPI(title="INGRES MCP API Bridge", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MCPToolRequest(BaseModel):
    tool: str
    parameters: Dict[str, Any] = {}

class MCPResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    timestamp: str

async def call_mcp_server(tool_name: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
    """Call the MCP server with specified tool and parameters"""
    try:
        # Prepare the MCP call
        mcp_input = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": parameters
            }
        }
        
        # Call MCP server via subprocess (stdin/stdout)
        process = await asyncio.create_subprocess_exec(
            "python", "mcp_server.py",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # Send request and get response
        stdout, stderr = await process.communicate(
            input=json.dumps(mcp_input).encode()
        )
        
        if process.returncode != 0:
            logger.error(f"MCP server error: {stderr.decode()}")
            return {
                "success": False,
                "error": f"MCP server failed: {stderr.decode()}"
            }
        
        # Parse response
        response = json.loads(stdout.decode())
        
        if "error" in response:
            return {
                "success": False,
                "error": response["error"]["message"]
            }
        
        # Parse the result (which is a JSON string from TextContent)
        result_text = response["result"]["content"][0]["text"]
        result_data = json.loads(result_text)
        
        return {
            "success": True,
            **result_data
        }
        
    except Exception as e:
        logger.error(f"MCP call failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "INGRES MCP API Bridge"
    }

@app.post("/mcp/call-tool")
async def call_tool(request: MCPToolRequest):
    """Call MCP tool endpoint"""
    try:
        result = await call_mcp_server(request.tool, request.parameters)
        
        return MCPResponse(
            success=result.get("success", False),
            data=result,
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Tool call failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """File upload endpoint"""
    try:
        # Read file content
        content = await file.read()
        
        # Convert to base64
        import base64
        base64_content = base64.b64encode(content).decode()
        
        # Call MCP upload tool
        result = await call_mcp_server("upload_csv_data", {
            "file_content": base64_content,
            "filename": file.filename,
            "user_info": f"API upload at {datetime.now().isoformat()}"
        })
        
        return result
        
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download/{file_id}")
async def download_file(file_id: str):
    """File download endpoint"""
    try:
        result = await call_mcp_server("download_data", {
            "file_id": file_id,
            "format": "csv"
        })
        
        if not result.get("success"):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Return file content
        return JSONResponse(content=result)
        
    except Exception as e:
        logger.error(f"File download failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/files")
async def list_files():
    """List uploaded files"""
    try:
        result = await call_mcp_server("list_uploaded_files", {})
        return result
        
    except Exception as e:
        logger.error(f"File listing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Specific endpoints for common operations
@app.get("/groundwater")
async def get_groundwater_data(
    state: Optional[str] = None,
    district: Optional[str] = None,
    year: Optional[str] = None
):
    """Get groundwater data with filters"""
    try:
        filters = {}
        if state:
            filters["state"] = state
        if district:
            filters["district"] = district
        if year:
            filters["year"] = year
            
        result = await call_mcp_server("get_groundwater_levels", filters)
        return result
        
    except Exception as e:
        logger.error(f"Groundwater data fetch failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat_query(request: Dict[str, Any]):
    """Chat with RAG system"""
    try:
        result = await call_mcp_server("rag_query", request)
        return result
        
    except Exception as e:
        logger.error(f"Chat query failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
