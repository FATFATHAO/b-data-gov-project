from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt
from fastapi import APIRouter, HTTPException, status
from backend.database import get_pg_connection, init_auth_tables
from backend.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, RegisterResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

# JWT 配置
SECRET_KEY = "b-datagov-lite-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


@router.post("/register", response_model=RegisterResponse)
def register(req: RegisterRequest):
    conn = get_pg_connection()
    try:
        with conn.cursor() as cur:
            # 检查用户名是否已存在
            cur.execute("SELECT id FROM users WHERE username = %s", (req.username,))
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="用户名已存在"
                )

            # 创建用户
            password_hash = get_password_hash(req.password)
            cur.execute(
                "INSERT INTO users (username, nickname, password_hash) VALUES (%s, %s, %s) RETURNING id",
                (req.username, req.nickname, password_hash)
            )
            user_id = cur.fetchone()["id"]
        conn.commit()
        return RegisterResponse(message="注册成功", user_id=user_id)
    finally:
        conn.close()


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    conn = get_pg_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, nickname, password_hash FROM users WHERE username = %s",
                (req.username,)
            )
            user = cur.fetchone()

            if not user or not verify_password(req.password, user["password_hash"]):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="用户名或密码错误"
                )

            access_token = create_access_token({
                "sub": user["username"],
                "user_id": user["id"]
            })

            return TokenResponse(
                access_token=access_token,
                user={
                    "id": user["id"],
                    "username": user["username"],
                    "nickname": user["nickname"]
                }
            )
    finally:
        conn.close()


# 初始化时创建表
init_auth_tables()
