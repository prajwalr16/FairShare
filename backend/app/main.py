from fastapi import FastAPI

app = FastAPI(title="FairShare API", version="0.1.0")

@app.get("/")
async def health():
    return {"status":"healthy","app":"FairShare"}
