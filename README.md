This is a minimal static site generator for my personal website.

# Prerequisites

- [Node.js](https://nodejs.org/en)
- [Python 3](https://www.python.org/)

# Libraries

- [Marked](https://github.com/markedjs/marked)
- [front-matter](https://github.com/jxson/front-matter/)
- [github-markdown-css](https://github.com/sindresorhus/github-markdown-css)
- [Chokidar](https://github.com/paulmillr/chokidar)
- [Tabler Icons](https://github.com/tabler/tabler-icons)
- [Feather](https://github.com/feathericons/feather)

# Quick Setup

```bash
# Clone the repository
git clone https://github.com/FaridZelli/faridzelli.com

# Change your working directory
cd faridzelli.com

# Pull required dependencies from npm
npm install
```

# Usage

```bash
# Build the website
node build

# Run a local HTTP server at http://127.0.0.1:8000
node build --live
```
