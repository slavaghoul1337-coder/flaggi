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
      const { wallet, txHash } = req.body || {};

      if (!wallet || !txHash) {
        return res
          .status(400)
          .json({ success: false, message: "Missing wallet or transaction hash" });
      }

      // Симуляция успешного минта
      return res.status(200).json({
        success: true,
        wallet,
        minted: 1,
        txHash,
        message: "✅ Successfully minted 1 FLAGGI NFT"
      });
    } catch (err) {
      return res
        .status(500)
        .json({ success: false, message: "Server error", details: err.message });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
