import '@fontsource-variable/playfair-display';
import '@fontsource/reenie-beanie/latin-400.css';
import '@/styles/main.css';
import { App } from '@/app/App.js';

const app = new App();
app.init();

if (import.meta.hot) {
  import.meta.hot.dispose(() => app.destroy());
}
