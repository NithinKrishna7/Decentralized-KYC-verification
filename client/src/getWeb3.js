import Web3 from "web3";

const getWeb3 = async () => {
  if (window.ethereum) {
    const web3 = new Web3(window.ethereum);
    try {
      // Request account access if needed
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      return web3;
    } catch (error) {
      throw new Error("User denied MetaMask connection");
    }
  } else {
    throw new Error("MetaMask not detected. Please install MetaMask.");
  }
};

export default getWeb3;
