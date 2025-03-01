import pytest
from pathlib import Path
from tribe.src.python.core.agent_project_manager import AgentProjectManager

@pytest.fixture
def project_manager():
    return AgentProjectManager()

@pytest.fixture
def mock_project_structure(tmp_path):
    # Create a mock project structure for testing
    project_root = tmp_path / "test_project"
    project_root.mkdir()
    
    # Create some test files and directories
    (project_root / "src").mkdir()
    (project_root / "src" / "components").mkdir()
    (project_root / "src" / "components" / "Button.tsx").write_text(
        "export const Button = () => <button>Click me</button>"
    )
    (project_root / "package.json").write_text('{"name": "test-project"}')
    return project_root

def test_project_manager_initialization(project_manager):
    assert project_manager is not None

def test_get_project_context(project_manager, mock_project_structure):
    project_manager.set_project_root(str(mock_project_structure))
    context = project_manager.get_project_context()
    
    assert context is not None
    assert "projectRoot" in context
    assert "fileStructure" in context
    assert "dependencies" in context

def test_analyze_project_structure(project_manager, mock_project_structure):
    project_manager.set_project_root(str(mock_project_structure))
    structure = project_manager.analyze_project_structure()
    
    assert structure is not None
    assert "src" in structure
    assert "components" in structure["src"]
    assert "Button.tsx" in structure["src"]["components"]

def test_get_file_content(project_manager, mock_project_structure):
    project_manager.set_project_root(str(mock_project_structure))
    content = project_manager.get_file_content("src/components/Button.tsx")
    
    assert content is not None
    assert "Button" in content
    assert "Click me" in content

def test_get_project_dependencies(project_manager, mock_project_structure):
    project_manager.set_project_root(str(mock_project_structure))
    dependencies = project_manager.get_project_dependencies()
    
    assert dependencies is not None
    assert isinstance(dependencies, dict)

def test_find_related_files(project_manager, mock_project_structure):
    project_manager.set_project_root(str(mock_project_structure))
    related_files = project_manager.find_related_files("src/components/Button.tsx")
    
    assert related_files is not None
    assert isinstance(related_files, list)

def test_analyze_code_patterns(project_manager, mock_project_structure):
    project_manager.set_project_root(str(mock_project_structure))
    patterns = project_manager.analyze_code_patterns("src/components")
    
    assert patterns is not None
    assert "componentPatterns" in patterns
    assert "importPatterns" in patterns

def test_get_project_statistics(project_manager, mock_project_structure):
    project_manager.set_project_root(str(mock_project_structure))
    stats = project_manager.get_project_statistics()
    
    assert stats is not None
    assert "fileCount" in stats
    assert "directoryCount" in stats
    assert "languageStats" in stats

def test_validate_file_changes(project_manager, mock_project_structure):
    project_manager.set_project_root(str(mock_project_structure))
    changes = {
        "filesToModify": [
            {
                "path": "src/components/Button.tsx",
                "content": "export const Button = () => <button>New Text</button>"
            }
        ]
    }
    
    validation = project_manager.validate_file_changes(changes)
    assert validation["isValid"] is True
    assert "conflicts" in validation

def test_apply_file_changes(project_manager, mock_project_structure):
    project_manager.set_project_root(str(mock_project_structure))
    changes = {
        "filesToModify": [
            {
                "path": "src/components/Button.tsx",
                "content": "export const Button = () => <button>New Text</button>"
            }
        ]
    }
    
    result = project_manager.apply_file_changes(changes)
    assert result["success"] is True
    assert result["modifiedFiles"] == ["src/components/Button.tsx"]

def test_get_project_type(project_manager, mock_project_structure):
    project_manager.set_project_root(str(mock_project_structure))
    project_type = project_manager.get_project_type()
    
    assert project_type is not None
    assert "type" in project_type
    assert "framework" in project_type

def test_analyze_dependencies(project_manager, mock_project_structure):
    project_manager.set_project_root(str(mock_project_structure))
    dependency_analysis = project_manager.analyze_dependencies()
    
    assert dependency_analysis is not None
    assert "directDependencies" in dependency_analysis
    assert "devDependencies" in dependency_analysis
    assert "unusedDependencies" in dependency_analysis

def test_get_project_configuration(project_manager, mock_project_structure):
    project_manager.set_project_root(str(mock_project_structure))
    config = project_manager.get_project_configuration()
    
    assert config is not None
    assert "packageJson" in config
    assert "tsConfig" in config

def test_analyze_imports(project_manager, mock_project_structure):
    project_manager.set_project_root(str(mock_project_structure))
    import_analysis = project_manager.analyze_imports("src/components/Button.tsx")
    
    assert import_analysis is not None
    assert "imports" in import_analysis
    assert "exports" in import_analysis

def test_get_file_history(project_manager, mock_project_structure):
    project_manager.set_project_root(str(mock_project_structure))
    history = project_manager.get_file_history("src/components/Button.tsx")
    
    assert history is not None
    assert isinstance(history, list)
    assert all("timestamp" in entry for entry in history)
    assert all("changes" in entry for entry in history)
