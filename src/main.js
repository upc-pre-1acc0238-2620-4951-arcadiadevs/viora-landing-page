import '@fontsource-variable/playfair-display';
import '@/styles/main.css';
import { App } from '@/app/App.js';

const app = new App();
app.init();

if (import.meta.hot) {
  import.meta.hot.dispose(() => app.destroy());
}
