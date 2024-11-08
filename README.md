# Easy Hybrid Web Office Planner

Welcome to the Easy Hybrid web office planner repository! This project is a front-end web application designed with React, TypeScript, and Vite, leveraging Tailwind CSS for styling and Lucide React for icons.

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Getting Started](#getting-started)
- [Development](#development)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)

## Project Overview

Easy Hybrid is a responsive web planner designed to track how many days I need to go to office.
## Features
- **Days required**: Show how many days you need to be in office.
- **Progress**: Overall progress and progress as of day which could be used to compare with commany monthly report.
- **One click attendance**: Mark attendance for today with one click.
- **Two clicks holiday**: Mark holiday for any date with two clicks. Holidays won't be counted in attendence percentage.
- **Data in your hand**: Data save as browser local storage. No need to login or signup.
- **Export/import**: Export your data to a file and import it back anytime.

## Getting Started

1. **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/easy-hybrid-web-planner.git
    cd easy-hybrid-web-planner
    ```

2. **Install dependencies**:
    ```bash
    npm install
    ```

3. **Run the development server**:
    ```bash
    npm run dev
    ```
   The application should now be running at `http://localhost:3000`.

## Development

- **Linting**: The project includes an ESLint configuration that enforces coding standards and best practices. Use the following command to run lint checks:
    ```bash
    npm run lint
    ```

- **Build**: Generate an optimized production build with:
    ```bash
    npm run build
    ```

## Configuration

The main configuration for the project can be found in `.bolt/config.json`. Here, the `template` is set to `bolt-vite-react-ts` to leverage a Vite-based TypeScript setup for a responsive and maintainable front end.

## Contributing

We welcome contributions! Please open an issue or submit a pull request with your improvements. Ensure all code passes linting and follows the project's style guidelines.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
