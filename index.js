import { AppRegistry } from 'react-native';
import App from './src/App';
import appConfig from './app.json';
const appName = appConfig.name;

AppRegistry.registerComponent(appName, () => App);

if (typeof document !== 'undefined') {
  const rootTag = document.getElementById('root');
  if (rootTag) {
    AppRegistry.runApplication(appName, { rootTag });
  }
}
