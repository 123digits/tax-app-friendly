import 'vuetify/styles';
import { createVuetify } from 'vuetify';

export default createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#1b5e20',
          secondary: '#2e7d32',
          accent: '#8bc34a',
        },
      },
    },
  },
});
