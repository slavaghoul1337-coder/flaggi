export default async function handler(req, res) {
  if (req.method === "GET") {
    // x402 metadata response
    return res.status(402).json({
      x402Version: 1,
      payer: "0x25C741BFEF028D49cE37595f466a8f3E80F474ca",
      accepts: [
        {
          resource: "https://flaggi.vercel.app/api/mint",
          scheme: "exact",
          network: "base",
          maxAmountRequired: "2.00",
          description: "Mint 1 FLAGGI NFT for $2.00",
          mimeType: "application/json",
          payTo: "0x25C741BFEF028D49cE37595f466a8f3E80F474ca",
          asset: "USDC",
          maxTimeoutSeconds: 10,
          outputSchema: {
            input: {
              type: "http",
              method: "POST",
              bodyType: "json"
            },
            output: {
              success: { type: "boolean" },
              message: { type: "string" }
            }
          },
          extra: {
            provider: "FLAGGI",
            category: "Minting"
          }
        }
      ]
    });
  }

  if (req.method === "POST") {
      try {
    const { wallet, txHash } = req.body;
    if (!wallet || !txHash) return res.status(400).json({ error: "Missing wallet or txHash" });

    const txReceipt = await provider.getTransactionReceipt(txHash);
    if (!txReceipt) return res.status(400).json({ error: "Transaction not found" });

    // Парсим события Transfer на USDC
    let valid = false;
    for (const log of txReceipt.logs) {
      if (log.address.toLowerCase() === USDC_CONTRACT.toLowerCase()) {
        try {
          const parsed = usdcContract.interface.parseLog(log);
          if (
            parsed.name === "Transfer" &&
            parsed.args.from.toLowerCase() === wallet.toLowerCase() &&
            parsed.args.to.toLowerCase() === PAY_TO.toLowerCase() &&
            parsed.args.value >= MIN_USDC_AMOUNT
          ) {
            valid = true;
            break;
          }
        } catch {}
      }
    }

    if (!valid) return res.status(400).json({ error: "Transaction sent to wrong address or amount too low" });

    return res.status(200).json({
      success: true,
      wallet,
      txHash,
      verified: true,
      message: "✅ Payment verified successfully"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
