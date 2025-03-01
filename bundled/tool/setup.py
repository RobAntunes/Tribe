from setuptools import setup, find_packages

setup(
    name="tribe",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "pygls>=1.0.0",
        "crewai>=0.1.0",
    ],
)
