import os

os.environ["DATABASE_URL"] = "sqlite:///./test_verimed.db"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base, get_db
from app.main import app
from app.seed import seed_database

TEST_ENGINE = create_engine(
    "sqlite:///./test_verimed.db", connect_args={"check_same_thread": False}
)
TestingSession = sessionmaker(bind=TEST_ENGINE, expire_on_commit=False)


@pytest.fixture(scope="session")
def client() -> TestClient:
    Base.metadata.drop_all(TEST_ENGINE)
    Base.metadata.create_all(TEST_ENGINE)
    with TestingSession() as db:
        seed_database(db)

    def override_db():
        with TestingSession() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="session")
def db_session(client: TestClient) -> Session:
    del client
    with TestingSession() as db:
        yield db
