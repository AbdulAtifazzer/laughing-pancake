# Household Expenses Dashboard

A simple dashboard for tracking household spending in Sri Lankan rupees (LKR). Add the money you have, record what you spend, and see where it goes.

![Dashboard screenshot](images/screenshot.png)

**Live page:** https://YOUR-USERNAME.github.io/household-expenses/

## Features

- **Total money:** shows money you have, money spent and money left, with a status bar
- **Summary tiles:** total spent, daily average, largest category and budget used
- **Charts:** spending by month (stacked by category), spent against budget, and a rolling 7-day trend
- **Categories:** Groceries, Utilities, Transport, Dining out, Health, Home and repairs, Education, Leisure. Click a category to hide it from the charts
- **Ledger:** searchable list of every expense, with an add form
- **Light and dark mode:** follows your device setting
- **Works on phones:** layout adjusts to small screens

## Run it on your computer

You do not need to install anything.

1. Download or clone this repository.
2. Keep `index.html`, `style.css` and `script.js` in the same folder.
3. Double-click `index.html` to open it in your browser.

Or run it with a small local server:

```bash
# inside the project folder
python -m http.server 8000
```

Then open http://localhost:8000 in your browser.

In VS Code you can also right-click `index.html` and choose **Open with Live Server** (needs the Live Server extension).

## Publish it with GitHub Pages

1. Push the files to a GitHub repository.
2. Go to **Settings > Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and the `/ (root)` folder, then click **Save**.
4. After a minute or two your page is live at `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

## Project files

```
household-expenses/
├── index.html    page structure
├── style.css     styling and colours
├── script.js     data, charts and buttons
├── README.md     this file
└── images/       screenshots
```

## Where your data is saved

This version saves the expenses and money you add in your own browser (local storage). That means:

- your entries stay on the device and browser you used
- other people who open the page see an empty dashboard
- clearing your browser data removes your entries

## Built with

HTML, CSS and plain JavaScript. No frameworks or build step. Fonts come from Google Fonts, so an internet connection is needed for them to load.

## License

Add a license of your choice, for example [MIT](https://choosealicense.com/licenses/mit/).
