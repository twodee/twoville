import {
  interpret
} from './interpreter.js';

self.addEventListener('message', event => {
  switch (event.data.command) {
    case 'interpret':
      const result = interpret(event.data.source, message => self.postMessage({type: 'output', payload: message}));
      self.postMessage({type: 'environment', payload: result.toPod()});
      break;
    default:
      console.error(`I don't know command ${event.data.command}.`);
  }
}, false);
