const express = require('express');
const bodyParser = require('body-parser');
const packageInfo = require('./package.json');


const app = express();
const port = process.env.PORT || 8080;
app.use(bodyParser.json());

app.get('/', function (req, res) {
  res.json({ version: packageInfo.version });
});

const server = app.listen(port, () => {
  const host = server.address().address;
  const port = server.address().port;
  console.log('Web server started at http://%s:%s', host, port);
});

module.exports = (bot) => {
  app.post('/' + bot.token, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
};
