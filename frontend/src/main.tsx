import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ensureSeedData } from './utils/seedPlaybooks.ts';

ensureSeedData().then(() => {
  console.log('Dokion Playbooks Store initialized.');
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

