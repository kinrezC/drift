import { MockDrift } from "src/client/drift/MockDrift";
import { erc20 } from "src/utils/testing/erc20";
import { describe, expect, it } from "vitest";

describe("MockDrift", () => {
  describe("contract", () => {
    it("Creates mock read-write contracts", async () => {
      const mockDrift = new MockDrift();
      const mockContract = mockDrift.contract({
        abi: erc20.abi,
        address: "0xVaultAddress",
      });

      mockContract
        .onWrite("approve", {
          spender: "0x1",
          amount: 100n,
        })
        .resolves("0xHash");

      expect(
        await mockContract.write("approve", {
          spender: "0x1",
          amount: 100n,
        }),
      ).toBe("0xHash");
    });

    it("Creates contracts that share mock values", async () => {
      const mockDrift = new MockDrift();
      const contract = mockDrift.contract({
        abi: erc20.abi,
        address: "0xVaultAddress",
      });

      mockDrift
        .onRead({
          abi: erc20.abi,
          address: "0xVaultAddress",
          fn: "symbol",
        })
        .resolves("VAULT");

      expect(await contract.read("symbol")).toBe("VAULT");

      contract.onRead("name").resolves("Vault Token");

      expect(
        await mockDrift.read({
          abi: erc20.abi,
          address: "0xVaultAddress",
          fn: "name",
        }),
      ).toBe("Vault Token");
    });

    it("Creates contracts that share cache values", async () => {
      const mockDrift = new MockDrift();
      const contract = mockDrift.contract({
        abi: erc20.abi,
        address: "0xVaultAddress",
      });

      mockDrift.cache.preloadRead({
        abi: erc20.abi,
        address: "0xVaultAddress",
        fn: "symbol",
        value: "VAULT",
      });

      expect(await contract.read("symbol")).toBe("VAULT");
    });
  });
});
