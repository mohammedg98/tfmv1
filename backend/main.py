from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.routes import user_routes
from backend.data_managment import router as data_router
from backend.data_managment import init_connection_pool

app = FastAPI()


@app.middleware("http")
async def handle_options(request: Request, call_next):
    if request.method == "OPTIONS":
        return JSONResponse(status_code=200)
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Set-Cookie"]
)

@app.on_event("startup")
async def startup_event():
    init_connection_pool()
    print("✅ Startup + CORS chargé")

# Routes
app.include_router(user_routes.router, prefix="/api/users")
app.include_router(data_router)

@app.get("/")
def read_root():
    return {"message": "Bienvenue sur l'API"}
