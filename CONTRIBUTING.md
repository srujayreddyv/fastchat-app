# Contributing to FastChat

Thank you for your interest in contributing to FastChat! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- PostgreSQL (Neon recommended)
- Docker & Docker Compose
- Git

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/fastchat-app.git
   cd fastchat-app
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/fastchat-app.git
   ```

## Development Setup

### 1. Environment Setup

```bash
# Copy environment file
cp env.example .env

# Edit .env with your configuration
# Add your DATABASE_URL (Neon recommended)
```

### 2. Backend Setup

```bash
# Create virtual environment
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload
```

### 3. Frontend Setup

```bash
# Install dependencies
cd frontend
npm install

# Start development server
npm run dev
```

### 4. Docker Setup (Alternative)

```bash
# Build and start services
make up

# View logs
make logs
```

## Code Style

### Python (Backend)

We use **Black** for code formatting and **Ruff** for linting:

```bash
# Format code
black .

# Lint code
ruff check .

# Fix linting issues
ruff check --fix .
```

**Guidelines:**

- Follow PEP 8 style guide
- Use type hints for all functions
- Write docstrings for public functions
- Keep functions small and focused
- Use meaningful variable names

### TypeScript/JavaScript (Frontend)

We use **Prettier** for formatting and **ESLint** for linting:

```bash
# Format code
npm run format

# Lint code
npm run lint

# Fix linting issues
npm run lint -- --fix
```

**Guidelines:**

- Use TypeScript for all new code
- Follow React best practices
- Use functional components with hooks
- Keep components small and focused
- Use meaningful prop and variable names

## Testing

### Backend Testing

```bash
# Run tests
cd backend
pytest

# Run tests with coverage
pytest --cov=app

# Run specific test file
pytest tests/test_presence.py
```

### Frontend Testing

```bash
# Run tests
cd frontend
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Manual Testing

Use the provided test script:

```bash
python scripts/manual_test.py
```

## Pull Request Process

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

- Write clear, focused commits
- Follow the code style guidelines
- Add tests for new features
- Update documentation if needed

### 3. Test Your Changes

```bash
# Backend tests
cd backend && pytest

# Frontend tests
cd frontend && npm test

# Linting
make lint

# Manual testing
python scripts/manual_test.py
```

### 4. Commit Your Changes

```bash
# Add your changes
git add .

# Commit with a clear message
git commit -m "feat: add user authentication

- Add JWT authentication system
- Implement login/logout functionality
- Add user profile management
- Update API documentation

Closes #123"
```

**Commit Message Format:**

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `style:` for formatting changes
- `refactor:` for code refactoring
- `test:` for adding tests
- `chore:` for maintenance tasks

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:

- **Clear title** describing the change
- **Detailed description** of what was changed and why
- **Screenshots** for UI changes
- **Test instructions** for reviewers
- **Related issues** if applicable

### 6. PR Review Process

- All PRs require at least one review
- Address review comments promptly
- Ensure CI checks pass
- Update PR description if needed

## Issue Reporting

### Before Creating an Issue

1. Check existing issues for duplicates
2. Search the documentation
3. Try to reproduce the issue

### Issue Template

Use the provided issue templates:

- **Bug Report**: For reporting bugs
- **Feature Request**: For requesting new features
- **Documentation**: For documentation improvements

### Bug Report Guidelines

- **Clear title** describing the issue
- **Detailed description** of the problem
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Environment information** (OS, browser, versions)
- **Screenshots** if applicable
- **Console logs** for frontend issues

## Development Workflow

### Daily Development

1. **Start the day:**

   ```bash
   git checkout main
   git pull upstream main
   ```

2. **Create feature branch:**

   ```bash
   git checkout -b feature/your-feature
   ```

3. **Make changes and test:**

   ```bash
   # Make your changes
   make lint  # Check code style
   make test  # Run tests
   ```

4. **Commit and push:**
   ```bash
   git add .
   git commit -m "descriptive message"
   git push origin feature/your-feature
   ```

### Code Review Checklist

Before submitting a PR, ensure:

- [ ] Code follows style guidelines
- [ ] Tests pass and coverage is adequate
- [ ] Documentation is updated
- [ ] No console errors or warnings
- [ ] Manual testing completed
- [ ] Commit messages are clear
- [ ] PR description is comprehensive

## Getting Help

- **Documentation**: Check the [README.md](README.md) and [docs/](docs/) folder
- **Issues**: Search existing issues or create a new one
- **Discussions**: Use GitHub Discussions for questions
- **Code Review**: Ask for help in PR reviews

## Recognition

Contributors will be recognized in:

- [Contributors](https://github.com/ORIGINAL_OWNER/fastchat-app/graphs/contributors) page
- Project documentation
- Release notes

Thank you for contributing to FastChat! 🚀
