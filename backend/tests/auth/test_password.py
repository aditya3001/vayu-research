from auth.password import hash_password, verify_password


def test_hash_is_not_plaintext():
    hashed = hash_password("mysecret")
    assert hashed != "mysecret"
    # bcrypt hashes always start with $2
    assert hashed.startswith("$2")


def test_verify_correct_password_returns_true():
    hashed = hash_password("correct-horse-battery")
    assert verify_password("correct-horse-battery", hashed) is True


def test_verify_wrong_password_returns_false():
    hashed = hash_password("rightpassword")
    assert verify_password("wrongpassword", hashed) is False


def test_same_password_hashes_differently():
    # bcrypt uses random salts
    h1 = hash_password("same")
    h2 = hash_password("same")
    assert h1 != h2
    assert verify_password("same", h1) is True
    assert verify_password("same", h2) is True
