## Install

```bash
git clone https://github.com/louislouist/77sq

npm install
cd node_modules/closest-airport-static-utils
npm run build
npm run fetch-data
```
(insure all fetched items completed successfully)

```bash
cd ../icao-designation
```
(from <project_root>/node_modules/closest-airport-static-utils).
```bash
npm run build
npm run fetch-data (some setups requre chromium to be installed. use your favorite package manager)
```
```bash
cd ../postreddit
```
(from <project_root>/node_modules/icao-designation).
```bash
npm run build
```

### project build
```bash
cd ../.. (back to 77sq project_root)
(add .env for social posting (if desired) for this service.)
npm run build
npm run start
```

