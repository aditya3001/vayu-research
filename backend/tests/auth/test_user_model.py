from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base


def test_user_table_created():
    from auth.models import User
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    u = User(email="test@example.com", provider="email", hashed_password="hashed")
    db.add(u)
    db.commit()
    found = db.query(User).filter_by(email="test@example.com").first()
    assert found is not None
    assert found.id is not None
    assert found.provider == "email"
    assert found.hashed_password == "hashed"
    assert found.created_at is not None
    db.close()


def test_user_email_is_unique():
    from auth.models import User
    import pytest
    from sqlalchemy.exc import IntegrityError
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    db.add(User(email="dup@example.com", provider="email"))
    db.commit()
    db.add(User(email="dup@example.com", provider="github"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.close()
