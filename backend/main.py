from fastapi import FastAPI

app = FastAPI(title="Event Management API")

@app.get("/")
def read_root():
    return {"message": "Hello from FastAPI backend!"}