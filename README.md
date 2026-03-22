# CTFd Fill in the Blank Challenge

A CTFd plugin that adds a **Fill in the Blank** challenge type. Admins write a text with numbered blanks using `[[1]]`, `[[2]]`, etc., and players must fill in each blank to solve the challenge.

## Features

- Custom `fill_blank` challenge type integrated into CTFd
- Simple blank syntax: `[[1]]`, `[[2]]`... directly in the challenge text
- Multiple valid answers per blank (case-insensitive, accent-insensitive)
- Live preview in the admin editor
- Per-blank feedback: players see which blanks are correct or incorrect
- All blanks must be correct to earn points

## Installation

1. Copy the `ctfd-fill-blank-challenge` folder into your CTFd `plugins/` directory:

```
CTFd/plugins/ctfd-fill-blank-challenge/
```

2. Restart CTFd. The plugin registers automatically on startup.

## Usage

### Creating a challenge (admin)

1. Go to **Admin > Challenges > New Challenge**
2. Select the type **fill_blank**
3. Write your text in the **Blank text** field using `[[1]]`, `[[2]]`, etc. to mark blanks

   Example:
   ```
   The HTTP status code for "Not Found" is [[1]] and for "Forbidden" is [[2]].
   ```

4. Click **Detect blanks** to generate answer fields
5. Enter one or more valid answers per blank
6. Save the challenge

### Player experience

Players see the text rendered with interactive input fields in place of each blank. After submitting, they receive feedback indicating which blanks are correct and which need to be revised.

## Dependencies

- CTFd >= v3.x
- Compatible with Docker and local installations
- An up-to-date browser with JavaScript enabled
- CTFd theme: Core-beta

## Support

For any question or issue, open an [issue](https://github.com/votre-utilisateur/ctfd-fill-blank-challenge/issues).
Or contact us on the Hack'olyte association website: [contact](https://hackolyte.fr/contact/).

## Contributing

Contributions are welcome!
You can:

- Report bugs
- Suggest new features
- Submit pull requests

## License

This plugin is licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/).

The original idea for this plugin does not come from Hack’olyte; it was discovered during CTFd competitions in 2025.

