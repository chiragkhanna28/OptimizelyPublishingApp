import {AxiomProvider} from '@optiaxiom/react';
import {register} from '@optimizely/cms-extensibility-sdk';
import {PublishChildren} from './PublishChildren';

// Register once, at module top level. The SDK mounts the returned React tree inside the CMS iframe.
// Toasts sit at the top so they never cover the sticky action bar; the sidebar can be 300 px wide.
register((context) => (
  <AxiomProvider toast={{position: 'top', p: '12'}}>
    <PublishChildren context={context} />
  </AxiomProvider>
));
