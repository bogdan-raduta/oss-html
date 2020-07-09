# oss-html

oss-html is a node.js command line for parsing and generating html file from OSS review toolkit scanning JSON output.

## Installation

Use the package manager [npm](https://www.npmjs.com/get-npm) to install oss-html.

```bash
npm install -g oss-html
```

## Usage

```commandline
oss-html -i scan.json -o scan.html

Usage: -i <json_file> -o <html_file>

Options:
  --help           Show help                                           [boolean]
  --version        Show version number                                 [boolean]
  -i, --json_file  JSON file used for conversion             [string] [required]
  -o, --html_file  HTML file used for output                 [string] [required]

```

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
[MIT](https://choosealicense.com/licenses/mit/)
