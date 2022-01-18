# crowdin-integration
Common setup for fetching and updating translations using the crowdin API.

# Usage

Config should go into `crowdin.json`. See the example file [here](https://github.com/connectedcars/crowdin-integration/blob/master/crowdin.json).

On the Crowdin, go to your project -> content -> settings on the `.pot` file. In `Resulting file after translations export`, the value should be `/locales/%two_letters_code%.po` to get a consistent path to use. Alternatively put a `languageMap` in the `crowdin.json` setting file, mapping the language codes to the desired output.

Add the two supplied scripts to your package file:

```json
    "upload-translations": "upload-translations",
    "fetch-translations": "fetch-translations",
```

`upload-translations` uploads the `template.pot` located in the configured `workingDir` and updates crowdin to use it.

`fetch-translations` downloads a zip file containing the `.po` files. The files are extracted and moved to the working directory. Optionally a pull request is created, featuring a more readable diff, making it easier to quickly validate the actual translation changes.


Settings overview:

| Setting | Description | Sample value | 
| --- | --- |
| `project` | The crowdin 'project name'. | connectedcars-mobileapp | 
| `projectId` | The crowdin 'project id'. Can be found on the project home page under details. | 306911 |
| `CROWDIN_API_TOKEN` | Personal Access Token from [Crowdin](https://crowdin.com/settings#api-key). Prefereably use as env var  | b0088e9fa4657726a85273d5f70bf483ab73d1d0fa165b2b92edfc25f04ae8f21d8aa3891f060a82 |
| `workingDir` | The local directory in the project where the `.po` and `.pot` files are. | locales |
| `remotePath` | The full remote path | /develop/locales/template.pot |
| `extractPath` | The path inside the zip file crowdin provides. | develop/locales |
| `supportedLanguages` | A list of the languages to extract. | [ "da", "de", "sv", "es", "fi", "fr" ] |
| `pullRequest` | Optional settings for creating an automatic pull request. | { "githubProject": "connectedcars/mobile-app", "baseBranch": "develop" }
| `force` | Force pull request creation or source upload when outside basebranch. Prefereably use as argument: `--force` | { "githubProject": "connectedcars/mobile-app", "baseBranch": "develop" }
