from pydantic import BaseModel


class RegisterRequest(BaseModel):
    username: str
    nickname: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class RegisterResponse(BaseModel):
    message: str
    user_id: int
