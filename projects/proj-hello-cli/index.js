const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 [options]')
  .option('name', {
    alias: 'n',
    type: 'string',
    describe: 'Your name',
  })
  .option('age', {
    alias: 'a',
    type: 'number',
    describe: 'Your age',
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    describe: 'Enable verbose output',
    default: false,
  })
  .help('help')
  .alias('help', 'h')
  .version(false)
  .parse();

if (argv.verbose) {
  console.log('Parsed arguments:', argv);
}

if (argv.name) {
  const agePart = typeof argv.age === 'number' ? ` and you are ${argv.age}` : '';
  console.log(`Hello, ${argv.name}${agePart}.`);
} else {
  console.log('No name provided. Use --name to specify your name.');
}