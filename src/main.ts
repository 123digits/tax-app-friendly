import { createApp } from 'vue';
import App from './App.vue';
import vuetify from './plugins/vuetify';
import pinia from './plugins/pinia';
import router from './router';
import '@mdi/font/css/materialdesignicons.css';

const app = createApp(App);
app.use(pinia);
app.use(router);
app.use(vuetify);
app.mount('#app');
