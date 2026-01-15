# Contributing to Chantier

First off, thank you for considering contributing to Chantier! It's people like you that make Chantier such a great platform.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title**
* **Describe the exact steps which reproduce the problem**
* **Provide specific examples to demonstrate the steps**
* **Describe the behavior you observed after following the steps**
* **Explain which behavior you expected to see instead and why**
* **Include screenshots if possible**
* **Include your environment details** (OS, Node version, browser, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title**
* **Provide a step-by-step description of the suggested enhancement**
* **Provide specific examples to demonstrate the steps**
* **Describe the current behavior and explain the behavior you expected to see**
* **Explain why this enhancement would be useful**

### Pull Requests

* Fill in the required template
* Do not include issue numbers in the PR title
* Follow the JavaScript/React styleguides
* Include thoughtfully-worded, well-structured tests
* Document new code
* End all files with a newline

## Development Process

### Setup Development Environment

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/Chantier.git`
3. Add upstream remote: `git remote add upstream https://github.com/elambiel83-stack/Chantier.git`
4. Create a new branch: `git checkout -b feature/amazing-feature`
5. Install dependencies: `npm run install-all`
6. Make your changes
7. Test your changes
8. Commit your changes: `git commit -m 'Add some amazing feature'`
9. Push to your fork: `git push origin feature/amazing-feature`
10. Open a Pull Request

### Coding Standards

#### JavaScript/React Style Guide

* Use ES6+ features
* Use functional components with hooks
* Use const/let instead of var
* Use meaningful variable names
* Add comments for complex logic
* Keep functions small and focused
* Use async/await instead of promises when possible

#### File Organization

* Components should be in their own files
* Group related files together
* Use index.js for exports when appropriate
* Keep files under 300 lines when possible

#### Naming Conventions

* Components: PascalCase (e.g., `ProductCard.js`)
* Functions: camelCase (e.g., `fetchProducts`)
* Constants: UPPER_SNAKE_CASE (e.g., `API_URL`)
* Files: camelCase or PascalCase depending on content

### Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

Examples:
```
Add user authentication feature

- Implement JWT token generation
- Add login and register endpoints
- Create auth middleware
- Add tests for authentication

Fixes #123
```

### Testing

* Write tests for new features
* Ensure all tests pass before submitting PR
* Aim for high test coverage
* Test both success and error cases

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Documentation

* Update README.md if needed
* Document API changes in API_DOCUMENTATION.md
* Add JSDoc comments for functions
* Update relevant guides

## Project Structure

Understanding the project structure will help you contribute effectively:

```
Chantier/
├── backend/              # Node.js/Express API
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── middleware/      # Express middleware
│   └── controllers/     # Route controllers
├── web/                 # React web application
│   ├── public/         # Static files
│   └── src/
│       ├── components/ # Reusable components
│       ├── pages/      # Page components
│       ├── services/   # API services
│       └── styles/     # CSS files
└── mobile/             # React Native app
    └── src/
        ├── screens/    # Screen components
        ├── components/ # Reusable components
        ├── navigation/ # Navigation setup
        └── services/   # API services
```

## What Can You Work On?

### Good First Issues

Look for issues labeled `good first issue` - these are great for beginners!

### Areas That Need Help

* **Features**: Check issues labeled `enhancement`
* **Bugs**: Check issues labeled `bug`
* **Documentation**: Improvements to docs are always welcome
* **Tests**: Increasing test coverage
* **Performance**: Optimization opportunities
* **UI/UX**: Design improvements

## Review Process

1. Maintainers will review your PR
2. They may request changes or ask questions
3. Make requested changes
4. Once approved, a maintainer will merge your PR

## Community

* Be respectful and inclusive
* Help others when you can
* Share your knowledge
* Be open to feedback

## Questions?

Feel free to open an issue with the label `question` if you need help!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Chantier! 🏗️
