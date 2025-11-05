from dotenv import load_dotenv
import os

load_dotenv()

print("DATABASE_URL =", os.getenv("DATABASE_URL"))
print("DATABASE_LOCAL =", os.getenv("DATABASE_LOCAL"))
print("USE_LOCAL_DB =", os.getenv("USE_LOCAL_DB"))
