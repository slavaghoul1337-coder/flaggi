import express from "express";
import { ethers } from "ethers";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Конфигурация ---
const RPC_URL =
  process.env.RPC_URL ||
  "https://rpc.ankr.com/base/4d93f615e8a7a794300afd50f0093768551d8bcb3cadce7dccbe986e55cbdf09";
const PAY_TO =
  process.env.PAY_TO ||
  "0x25C741BFEF028D49cE37595f466a8f3E80F474ca";
const USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC token на Base
const MIN_USDC_AMOUNT = 2_000_000n; // 2 USDC, 6 decimals
const VERIFY_URL = "https://flaggi1.vercel.app/verifyOwnership";

// --- ERC20 ABI minimal ---
const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const usdcContract = new ethers.Contract(USDC_CONTRACT, ERC20_ABI, provider);

// --- GET ресурс для X402 ---
app.options("/mint", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return res.sendStatus(204);
});

// Строго типизированный x402 response
app.get("/mint", (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");

  // 3 USDC -> 3 * 10^6 = 3000000 (USDC has 6 decimals)
  const maxAtomic = "3000000";

  res.status(402).json({
    x402Version: 1,
    payer: PAY_TO,
    accepts: [
      {
        scheme: "exact",
        network: "base",
        // string in atomic units
        maxAmountRequired: maxAtomic,
        resource: "https://flaggi1.vercel.app/mint",
        description: "Mint 1 FLAGGI NFT for $3.00",
        mimeType: "application/json",
        payTo: PAY_TO,
        // USDC contract address on Base (use your constant)
        asset: USDC_CONTRACT,
        maxTimeoutSeconds: 10,
        // строго-типизированная схема для входа/выхода
        outputSchema: {
          input: {
            type: "http",
            method: "POST",
            bodyType: "json",
            // bodyFields описывают поля POST тела; required указываем булевым флагом
            bodyFields: {
              wallet: {
                type: "string",
                required: true,
                description: "Wallet address (EOA) paying for mint"
              },
              txHash: {
                type: "string",
                required: true,
                description: "Transaction hash of the USDC transfer"
              }
            }
          },
          // output — перечисляем именно те поля, которые POST вернёт обратно
          output: {
            success: "boolean",
            message: "string"
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
    if (!wallet || !txHash) {
      return res.status(400).json({
        success: false,
        message: "Missing wallet or txHash"
      });
    }

    const txReceipt = await provider.getTransactionReceipt(txHash);
    if (!txReceipt) {
      return res.status(400).json({
        success: false,
        message: "Transaction not found or pending"
      });
    }

    let valid = false;
    for (const log of txReceipt.logs) {
      if (log.address.toLowerCase() === USDC_CONTRACT.toLowerCase()) {
        try {
          const parsed = usdcContract.interface.parseLog(log);
          if (
            parsed.name === "Transfer" &&
            parsed.args.from.toLowerCase() === wallet.toLowerCase() &&
            parsed.args.to.toLowerCase() === PAY_TO.toLowerCase()
          ) {
            // parsed.args.value может быть BigNumber/BigInt-like
            const value = BigInt(parsed.args.value.toString ? parsed.args.value.toString() : parsed.args.value);
            if (value >= MIN_USDC_AMOUNT) {
              valid = true;
              break;
            }
          }
        } catch (e) {
          // игнорируем логи, которые не парсятся
        }
      }
    }

    if (!valid) {
      return res.status(400).json({
        success: false,
        message: "Payment not verified: wrong recipient or insufficient amount"
      });
    }

    // Успешный ответ — строго соответствуем outputSchema.output
    return res.status(200).json({
      success: true,
      message: "FLAGGI NFT minted successfully"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`FLAGGI API running on port ${port}`));

export default app;
