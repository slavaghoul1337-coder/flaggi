import express from "express";
import { ethers } from "ethers";

const app = express();
app.use(express.json());

// --- Конфигурация ---
const RPC_URL =
  process.env.RPC_URL ||
  "https://rpc.ankr.com/base/4d93f615e8a7a794300afd50f0093768551d8bcb3cadce7dccbe986e55cbdf09";
const PAY_TO =
  process.env.PAY_TO ||
  "0x25C741BFEF028D49cE37595f466a8f3E80F474ca";
const USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC token на Base
const MIN_USDC_AMOUNT = 2_000_000n; // 2 USDC, 6 decimals

// --- ERC20 ABI minimal ---
const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const usdcContract = new ethers.Contract(USDC_CONTRACT, ERC20_ABI, provider);

// --- GET ресурс для X402 ---
app.get("/mint", (req, res) => {
  res.status(402).json({
    x402Version: 1,
    payer: PAY_TO,
    accepts: [
      {
        resource: "https://flaggi.vercel.app/mint",
        scheme: "exact",
        network: "base",
        maxAmountRequired: "3.00",
        description: "Mint 1 FLAGGI NFT for $3.00",
        mimeType: "application/json",
        payTo: PAY_TO,
        asset: "USDC",
        maxTimeoutSeconds: 15,
        outputSchema: {
          input: {
            type: "http",
            method: "POST",
            bodyType: "json",
            bodyFields: {
              wallet: {
                type: "string",
                required: ["wallet"],
                description: "Wallet address"
              },
              txHash: {
                type: "string",
                required: ["txHash"],
                description: "Transaction hash"
              }
            }
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
});

// --- POST /mint для проверки транзакции ---
app.post("/mint", async (req, res) => {
  try {
    const { wallet, txHash } = req.body;
    if (!wallet || !txHash)
      return res.status(400).json({ error: "Missing wallet or txHash" });

    const txReceipt = await provider.getTransactionReceipt(txHash);
    if (!txReceipt)
      return res.status(400).json({ error: "Transaction not found" });

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

    if (!valid)
      return res.status(400).json({
        success: false,
        message: "❌ Payment not verified. Wrong address or amount too low."
      });

    return res.status(200).json({
      success: true,
      wallet,
      txHash,
      message: "✅ FLAGGI NFT minted successfully!"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// --- Старый /verifyOwnership оставляем ---
app.get("/verifyOwnership", (req, res) => {
  res.status(402).json({
    x402Version: 1,
    payer: PAY_TO,
    accepts: [
      {
        scheme: "exact",
        network: "base",
        maxAmountRequired: "2",
        resource: "https://flaggi.vercel.app/mint",
        description: "Verify USDC payment transaction",
        mimeType: "application/json",
        payTo: PAY_TO,
        maxTimeoutSeconds: 10,
        asset: "USDC"
      }
    ]
  });
});

app.post("/verifyOwnership", async (req, res) => {
  try {
    const { wallet, txHash } = req.body;
    if (!wallet || !txHash)
      return res.status(400).json({ error: "Missing wallet or txHash" });

    const txReceipt = await provider.getTransactionReceipt(txHash);
    if (!txReceipt)
      return res.status(400).json({ error: "Transaction not found" });

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

    if (!valid)
      return res
        .status(400)
        .json({ error: "Transaction sent to wrong address or amount too low" });

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
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`FLAGGI API running on port ${port}`));

export default app;
