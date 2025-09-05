# Persistent Tokens

Persist token data between scenes and create token templates.

## Features

-   💾 Persist token metadata between scenes.
-   ♊️ Create token templates to apply metadata when tokens are created.

## How to use

Right click a token to persist it. After that, you can manage the persisted token in the action window.

Persistence types:

-   In **unique** mode, whenever a token is updated, the persisted version of the token will be updated as well.
-   In **template** mode, you must right click a token and click 'Save to Template' to persist the current state of the selected token. After that, all new versions of the token will use the template metadata.

## Support

If you need support for this extension you can message me in the [Owlbear Rodeo Discord](https://discord.com/invite/u5RYMkV98s) @Nick or open an issue on [GitHub](https://github.com/desain/owlbear-persistence/issues).

## Development

After checkout, run `pnpm install`.

## How it Works

This project is a Typescript app with Vite as a bundler, using Material UI React components and a Zustand store.

Icons from https://game-icons.net.

## Building

This project uses [pnpm](https://pnpm.io/) as a package manager.

To install all the dependencies run:

`pnpm install`

To run in a development mode run:

`pnpm dev`

To make a production build run:

`pnpm build`

## To do

-   Include attachments
-   Warning + no sync when multiple unique tokens
-   Search

## License

GNU GPLv3
