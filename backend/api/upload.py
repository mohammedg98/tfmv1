from fastapi import FastAPI, File, UploadFile, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
import pandas as pd
import numpy as np
import os

app = FastAPI()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_current_user(token: str = Depends(oauth2_scheme)):
    # Implement your user authentication logic here
    # For simplicity, we'll just return the token
    return token

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), missingValueOption: str = None, customValue: str = None, current_user: str = Depends(get_current_user)):
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    try:
        df = pd.read_excel(file.file) if file.filename.endswith('.xlsx') else pd.read_csv(file.file)

        if missingValueOption == "removeRows":
            df = df.dropna()
        elif missingValueOption == "removeColumns":
            df = df.dropna(axis=1)
        elif missingValueOption == "mean":
            df = df.fillna(df.mean())
        elif missingValueOption == "median":
            df = df.fillna(df.median())
        elif missingValueOption == "mode":
            df = df.fillna(df.mode().iloc[0])
        elif missingValueOption == "forwardFill":
            df = df.fillna(method='ffill')
        elif missingValueOption == "backwardFill":
            df = df.fillna(method='bfill')
        elif missingValueOption == "custom":
            df = df.fillna(customValue)

        # Save the modified dataframe to a file
        output_filename = f"user_{current_user}_modified_{file.filename}"
        df.to_excel(output_filename, index=False) if file.filename.endswith('.xlsx') else df.to_csv(output_filename, index=False)

        return {"message": "File uploaded and processed successfully", "filename": output_filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))