from setuptools import setup, find_packages

setup(
    name="tribe",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "pygls>=1.2.1",
        "packaging>=23.2",
        "typing-extensions>=4.9.0",
        "lsprotocol>=2023.0.0",
        "attrs>=23.2.0",
        "cattrs>=23.2.3",
        "exceptiongroup>=1.2.0",
        "streamlit>=1.31.1",
    ],
)
