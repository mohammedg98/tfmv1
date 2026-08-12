import time
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import psycopg2
from psycopg2 import pool
import atexit
import logging

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Configuration MongoDB
MONGO_URI = os.getenv("MONGO_URI")
client = None
db = None

# Configuration PostgreSQL
postgres_pool = None

def init_databases():
    """Initialise les connexions aux bases de données"""
    global client, db, postgres_pool
    
    try:
        # Initialisation MongoDB
        client = MongoClient(MONGO_URI)
        db = client["mern_database"]
        logger.info("Connexion MongoDB établie avec succès")

        # Initialisation PostgreSQL seulement si les variables sont définies
        if all(os.getenv(var) for var in ['POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD']):
            postgres_pool = psycopg2.pool.SimpleConnectionPool(
                minconn=1,
                maxconn=10,
                dbname=os.getenv('POSTGRES_DB'),
                user=os.getenv('POSTGRES_USER'),
                password=os.getenv('POSTGRES_PASSWORD'),
                host=os.getenv('POSTGRES_HOST', 'localhost'),
                port=os.getenv('POSTGRES_PORT', '5432')
            )
            logger.info("Pool de connexions PostgreSQL créé avec succès")
            
            # Test de connexion PostgreSQL
            conn = postgres_pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                logger.info("Test de connexion PostgreSQL réussi")
            finally:
                postgres_pool.putconn(conn)
        else:
            logger.warning("Configuration PostgreSQL manquante - PostgreSQL désactivé")

    except Exception as e:
        logger.error(f"Erreur d'initialisation des bases de données: {str(e)}")
        raise

def get_db_connection(timeout=30):
    start_time = time.time()
    while time.time() - start_time < timeout:
        if postgres_pool:
            try:
                return postgres_pool.getconn()
            except Exception:
                time.sleep(1)
        else:
            init_databases()
    raise RuntimeError("Connexion PostgreSQL impossible après délai d'attente")

def return_db_connection(conn):
    """Retourne une connexion PostgreSQL"""
    if postgres_pool and conn:
        postgres_pool.putconn(conn)

def cleanup_resources():
    """Nettoie les ressources à la fermeture"""
    global postgres_pool, client
    
    if postgres_pool:
        try:
            postgres_pool.closeall()
            logger.info("Pool PostgreSQL fermé")
        except Exception as e:
            logger.error(f"Erreur lors de la fermeture du pool PostgreSQL: {str(e)}")
    
    if client:
        try:
            client.close()
            logger.info("Connexion MongoDB fermée")
        except Exception as e:
            logger.error(f"Erreur lors de la fermeture de MongoDB: {str(e)}")

# Initialisation au démarrage
init_databases()
atexit.register(cleanup_resources)
