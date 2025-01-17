# Amman [![Build and Test](https://github.com/metaplex-foundation/amman/actions/workflows/build-and-test.yml/badge.svg)](https://github.com/metaplex-foundation/amman/actions/workflows/build-and-test.yml)

**A** **m** odern **man** datory toolbelt to help test miraland SDK libraries and apps on a locally
running validator.

## Amman CLI

Includes the _relay_, _validator interface_ and _mock storage server_.

Use this inside the `.ammanrc.js` config file as well as the `amman` command line tool it
includes on the terminal.

[Read More](./amman/README.md)

## Amman Client

Includes _asserts_, _address labeling_, _transaction interface_ and a client to the _relay_.
Use this inside your tests and the browser.

[Read More](./amman-client/README.md)

## Amman Tests

Test amman itself to make sure that configuratio of and communication with the
_miraland-test-validator_ works as expected and that requests to the relay are handled properly.

Deveolpers adding/changing a feature should add a test here to ensure it works.

[Read More](./amman-tests/README.md)

## LICENSE

Apache-2.0
