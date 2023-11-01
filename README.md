# Web Scraping with MySQL and Node.js

This project is aimed at scraping data from a website and storing it in a MySQL database using Node.js. It provides a scalable and collaborative solution for retrieving and managing data from a target website.

## Table of Contents

- [Project Overview](#project-overview)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Usage](#usage)
- [Folder Structure](#folder-structure)
- [Contributing](#contributing)
- [License](#license)

## Project Overview

Web scraping is a process of extracting data from websites, and this project focuses on automating this process. The project consists of several components:

- `check_database.js`: A script to check the database to determine the last page retrieved.
- `retrieve_pages.js`: Responsible for fetching web pages using Axios.
- `process_pages.js`: Parses the retrieved pages using Cheerio to extract data.
- `send_to_database.js`: Inserts the extracted data into a MySQL database.
- `scraper.js`: The main script that orchestrates the entire scraping process.

## Getting Started

### Prerequisites

Before running the project, ensure you have the following installed:

- Node.js
- MySQL database (with proper credentials)

### Installation

1. Clone this repository:

   ```shell
   git clone https://github.com/asinomasimple/panopticon_scraping.git