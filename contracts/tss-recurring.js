const {
  Networks,
  Asset,
  BASE_FEE,
  Operation,
  TransactionBuilder,
  Server,
} = require('stellar-sdk');
const moment = require('moment');

const cors = require('cors');
const { json } = require('body-parser');
const express = require('express');

const app = express(exports);

app.use(cors());
app.use(json());

const contractAddr = 'GD2APPYGV2DTVL4TLHTKYORSETCZGTDVU34TTATGX5S7JBCUTMJ5DKSM';
const server = new Server('https://horizon-testnet.stellar.org');
const XLM = Asset.native();

app.post('/', async (req, res) => {
  try {
    const transaction = await server.loadAccount(req.source).then((account) => {
      const now = moment.utc().startOf('minute');
      const minTime = now.clone().startOf('month');
      const maxTime = minTime.clone().endOf('month');

      const lastRanRaw = account.data_attr[`tss.${contractAddr}.ran`];

      if (lastRanRaw) {
        const lastRanParsed = Buffer.from(lastRanRaw, 'base64').toString(
          'utf8'
        );
        const lastRanDate = moment.utc(lastRanParsed, 'X');

        if (lastRanDate.startOf('month').isSame(minTime, 'month'))
          throw `It hasn't been a month since the last run`;
      }

      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        timebounds: {
          minTime: minTime.unix(),
          maxTime: maxTime.unix(),
        },
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.payment({
            destination: contractAddr,
            asset: XLM,
            amount: '1000',
          })
        )
        .addOperation(
          Operation.manageData({
            name: `tss.${contractAddr}.ran`,
            value: now.unix().toString(),
          })
        );

      for (const signer of signers) {
        transaction.addOperation(
          Operation.payment({
            destination: signer.turret,
            amount: signer.fee,
            asset: XLM,
          })
        );
      }

      return transaction;
    });

    res.send(transaction.build().toXDR());
  } catch (err) {
    sendError(err, res);
  }
});
