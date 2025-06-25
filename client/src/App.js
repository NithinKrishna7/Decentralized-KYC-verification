import React, { Component } from "react";
import KycBlockChain from "./contracts/KycBlockChain.json";
import getWeb3 from "./getWeb3";
import "./App.css";
import Web3 from "web3";

// Use web3.utils.soliditySha3 to match Solidity's keccak256 for strict security
const generateHash = (aadhar, pan) => {
  const web3 = new Web3();
  // Replicate Solidity's keccak256 packed hashing
  return web3.utils.soliditySha3({ type: "uint", value: aadhar }, { type: "string", value: pan });
};

const NAV_TABS = [
  { key: "new-customer", label: "Register as Customer" },
  { key: "existing-customer", label: "Customer Dashboard" },
  { key: "new-bank", label: "Register as Bank" },
  { key: "existing-bank", label: "Bank Dashboard" },
];

const GetAllBankAccounts = (props) => (
  <div className="bank-list-section">
    <h3 className="section-title">Verified Banks on Network</h3>
    {parseInt(props.bankcount) > 0 ? (
      <ul className="bank-list">
        {props.banks.map((bank) => (
          <li key={bank.key} className="bank-list-item">
            <span className="bank-address">{bank.address}</span>
          </li>
        ))}
      </ul>
    ) : (
      <div className="empty-state">
        <span className="empty-icon">🏦</span>
        <p>No verified banks found on this network.</p>
      </div>
    )}
  </div>
);

const GetAllBankRequests = (props) => (
  <div className="request-list-section">
    <h4 className="section-title">Pending Customer Requests</h4>
    {props.bankrequests.length > 0 ? (
      <ul className="request-list">
        {props.bankrequests.map((request) => (
          <li key={request.key} className="request-list-item">
            <span className="request-name">{request.name}</span>
            <span className="request-address">{request.address}</span>
          </li>
        ))}
      </ul>
    ) : (
      <div className="empty-state">
        <span className="empty-icon">📭</span>
        <p>No pending requests.</p>
      </div>
    )}
  </div>
);

//------tab navigation starts here--------
const hideAll = () => {
    document.getElementsByClassName("new-customer")[0].style.display = "none";
    document.getElementsByClassName("existing-customer")[0].style.display =
        "none";
    document.getElementsByClassName("existing-customer")[1].style.display =
        "none";
    document.getElementsByClassName("new-bank")[0].style.display = "none";
    document.getElementsByClassName("existing-bank")[0].style.display = "none";
    document.getElementsByClassName("existing-bank")[1].style.display = "none";
    let elements = document.querySelectorAll(".active-button");
    for (var i = 0; i < elements.length; i++) {
        elements[i].classList.remove("active-button");
    }
};

const show = (target) => {
    hideAll();
    document.getElementById(`${target}-button`).classList.add("active-button");
    if (target === "new-customer") {
        document.getElementsByClassName("new-customer")[0].style.display =
            "block";
    }
    if (target === "existing-customer") {
        document.getElementsByClassName("existing-customer")[0].style.display =
            "block";
        document.getElementsByClassName("existing-customer")[1].style.display =
            "block";
    }
    if (target === "existing-bank") {
        document.getElementsByClassName("existing-bank")[0].style.display =
            "block";
        document.getElementsByClassName("existing-bank")[1].style.display =
            "block";
    }
    if (target === "new-bank") {
        document.getElementsByClassName("new-bank")[0].style.display = "block";
    }
};
//------tab navigation ends here--------

//setting state values
class App extends Component {
    state = {
        web3: null,
        account: null,
        contract: null,
        name: "",
        aadhar: "",
        pan: "",
        getdata: "",
        b_name: "",
        bank_verify: "",
        entity: null,
        allbanks: [],
        allCustomers: [],
        bank_count: 0,
        status: null,
        requestAddress: "",
        bankrequests: [],
        associatedBank: { name: "", address: "" },
        aadharVerify: "",
        panVerify: "",
        verified: null,
        activeTab: NAV_TABS[0].key,
        loading: true,
        error: "",
        formErrors: {},
    };

    validateForm = (fields) => {
        const { aadhar, pan, bank_verify, name } = this.state;
        const web3 = this.state.web3;
        const errors = {};
        
        if (fields.includes('name') && (!name || name.length < 3)) {
            errors.name = "Name must be at least 3 characters long and match your official documents.";
        }
        if (fields.includes('aadhar') && !/^\d{12}$/.test(aadhar)) {
            errors.aadhar = "Aadhar number must be exactly 12 digits (e.g., 123456789012).";
        }
        if (fields.includes('pan') && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
            errors.pan = "PAN must be in the format ABCDE1234F (5 letters + 4 digits + 1 letter).";
        }
        if (fields.includes('bank_verify') && (!bank_verify || !web3.utils.isAddress(bank_verify))) {
            errors.bank_verify = "Please enter a valid Ethereum address starting with 0x followed by 40 characters.";
        }
        
        this.setState({ formErrors: errors });
        if (Object.keys(errors).length > 0) {
            alert("Please fix the validation errors before submitting. Check the messages below each field.");
        }
        return Object.keys(errors).length === 0;
    };

    async componentDidMount() {
        try {
          const web3 = await getWeb3();
          const accounts = await web3.eth.getAccounts();
          const networkId = await web3.eth.net.getId();
          const deployedNetwork = KycBlockChain.networks[networkId];
      
          if (!deployedNetwork) {
            throw new Error("Contract not deployed on this network. Please switch MetaMask to the correct network.");
          }
      
          const instance = new web3.eth.Contract(
            KycBlockChain.abi,
            deployedNetwork.address
          );
      
          this.setState({ web3, account: accounts[0], contract: instance }, async () => {
            await this.refreshUserData();
            await this.fetchAllLists();
            this.onAccountChanged();
          });

          this.setState({ loading: false });
        } catch (error) {
          this.setState({
            error: error.message || "Failed to load web3, accounts, or contract. See console for details.",
            loading: false,
          });
        }
    };

    onAccountChanged = () => {
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', async (accounts) => {
              this.setState({ account: accounts[0], error: "", verified: null, status: null, formErrors: {}, associatedBank: { name: "", address: "" } });
              await this.refreshUserData();
              await this.fetchAllLists();
            });
        }
    };

    handleTabChange = (tabKey) => {
        this.setState({ activeTab: tabKey, error: "", verified: null, status: null, formErrors: {} });
    };

    handleInputChange = (event) => {
        const { name, value } = event.target;
        this.setState({ [name]: value, formErrors: { ...this.state.formErrors, [name]: "" } });
    };

    myData2ChangeHandler = (event) => {
        this.setState({ panVerify: event.target.value });
    };
    myVBankChangeHandler = (event) => {
        this.setState({ bank_verify: event.target.value });
    };
    requestAddressChange = (event) => {
        this.setState({ requestAddress: event.target.value });
    };

    whoami = async () => {
        try {
            const { contract, account } = this.state;
            if (!contract) return;
            const cus = await contract.methods.isCus().call({ from: account });
            const org = await contract.methods.isOrg().call({ from: account });
            const who = cus ? "Customer" : org ? "Bank" : "None";
            this.setState({ entity: who });
        } catch (err) {
            this.setState({ error: "Could not determine user role. Is the contract available on this network?" });
        }
    };

    createmycustomer = async () => {
        if (!this.validateForm(['name', 'aadhar', 'pan', 'bank_verify'])) return;
        const { contract, name, aadhar, pan, bank_verify, account } = this.state;
        const hash = generateHash(aadhar, pan);
        try {
            await contract.methods.newCustomer(name, hash, bank_verify).send({ from: account });
            alert("You successfully made an account!");
            this.setState({ name: "", aadhar: "", pan: "", bank_verify: "" });
            await this.whoami();
            await this.numbanks();
        } catch (err) {
            const revertReason = err.message.includes("revert") ? err.message.split("revert ")[1] : "Transaction failed.";
            this.setState({ error: `Could not create account: ${revertReason}` });
        }
    };

    createmybank = async () => {
        const { contract, b_name, account } = this.state;
        try {
            await contract.methods.newOrganisation(b_name).send({ from: account });
            alert("You are now a verified Bank Entity!");
            this.setState({ b_name: "" });
            await this.whoami();
            await this.numbanks();
        } catch (err) {
            const revertReason = err.message.includes("revert") ? err.message.split("revert ")[1] : "Transaction failed.";
            this.setState({ error: `Could not create bank: ${revertReason}` });
        }
    };

    verifykycfromcustomer = async () => {
        const { contract, getdata, aadharVerify, panVerify, account } = this.state;
        try {
            const response = await contract.methods.viewCustomerData(getdata).call({ from: account });
            const dhash = generateHash(aadharVerify, panVerify);
            this.setState({ verified: dhash === response ? "Success" : "Fail", error: "" });
        } catch (err) {
            const revertReason = err.message.includes("revert") ? err.message.split("revert ")[1] : "Verification failed.";
            this.setState({ verified: null, error: `Could not verify data: ${revertReason}` });
        }
    };

    get = async () => {
        const { contract, account } = this.state;
        try {
            const access = await contract.methods.isOrg().call({ from: account });
            if (access) {
                await this.verifykycfromcustomer();
            } else {
                this.setState({ error: "You are not a verified Bank!" });
            }
        } catch (err) {
            const revertReason = err.message.includes("revert") ? err.message.split("revert ")[1] : "Verification failed.";
            this.setState({ error: `Verification failed: ${revertReason}` });
        }
    };

    create_customer = async (e) => {
        e.preventDefault();
        const { contract, account } = this.state;
        const access = await contract.methods.isCus().call({ from: account });
        if (!access) {
            await this.createmycustomer();
        } else {
            this.setState({ error: "You already have an account!" });
        }
    };

    create_bank = async (e) => {
        e.preventDefault();
        const { contract, account } = this.state;
        const access = await contract.methods.isOrg().call({ from: account });
        const ifcustomer = await contract.methods.isCus().call({ from: account });
        if (!access && !ifcustomer) {
            await this.createmybank();
        } else if (ifcustomer) {
            this.setState({ error: "Customer entities cannot be a bank!" });
        } else {
            this.setState({ error: "You are already a bank!" });
        }
    };

    modify_data = async (e) => {
        e.preventDefault();
        const { contract, name, aadhar, pan, bank_verify, account } = this.state;
        try {
            const hash = generateHash(aadhar, pan);
            await contract.methods.modifyCustomerData(name, hash, bank_verify).send({ from: account });
            alert("Data Changed!");
            this.setState({ name: "", aadhar: "", pan: "", bank_verify: "" });
            await this.getmystatus();
        } catch (err) {
            const revertReason = err.message.includes("revert") ? err.message.split("revert ")[1] : "Transaction failed.";
            this.setState({ error: `Could not update data: ${revertReason}` });
        }
    };

    numbanks = async () => {
        try {
            const { contract } = this.state;
            if (!contract) return;
            const len = await contract.methods.bankslength().call();
            this.setState({ bank_count: len });
            const banks = [];
            if (parseInt(len) > 0) {
                for (var i = 0; i < len; i++) {
                    banks.push({
                        key: i,
                        address: await contract.methods.Banks(i).call(),
                    });
                }
            }
            this.setState({ allbanks: banks });
        } catch (err) {
            this.setState({ error: "Could not fetch the list of banks from the contract." });
        }
    };

    getmystatus = async () => {
        try {
            const { contract, account } = this.state;
            if (!contract) return;
            const status = await contract.methods.checkStatus().call({ from: account });
            if (status === "0") this.setState({ status: "Accepted" });
            else if (status === "1") this.setState({ status: "Rejected" });
            else if (status === "2") this.setState({ status: "Pending" });
            else this.setState({ status: "Undefined" });
        } catch (err) {
            this.setState({ error: "Could not fetch your KYC status." });
        }
    };

    viewRequests = async () => {
        try {
            const { contract, account } = this.state;
            if (!contract) return;

            // Explicitly check if the user is a bank before proceeding.
            const isBank = await contract.methods.isOrg().call({ from: account });
            if (!isBank) {
                // Silently fail if not a bank. The UI already handles showing the correct view.
                // This prevents errors when switching accounts.
                return; 
            }

            const reqs = await contract.methods.viewRequests().call({ from: account });
            const all_reqs = [];
            for (let i = 0; i < reqs.length; i++) {
                all_reqs.push({
                    key: i,
                    address: reqs[i],
                    name: await contract.methods.viewName(reqs[i]).call(),
                });
            }
            this.setState({ bankrequests: all_reqs, error: "" });
        } catch (err) {
            // This will stop the alert from showing on the UI.
            // The actual error will be logged to the console for debugging.
            console.error("Could not fetch pending KYC requests:", err.message);
        }
    };

    accept = async () => {
        const { contract, requestAddress, account, web3 } = this.state;
        if (!web3.utils.isAddress(requestAddress)) {
            this.setState({ error: "Invalid Ethereum address provided for the request." });
            return;
        }
        try {
            const isBank = await contract.methods.isOrg().call({ from: account });
            if (!isBank) {
                this.setState({ error: "Action Failed: Your account is not registered as a Bank." });
                return;
            }
            await contract.methods.changeStatusToAccepted(requestAddress).send({ from: account });
            alert(`Request from ${requestAddress.substring(0, 10)}... has been accepted.`);
            this.setState({ requestAddress: "", error: "" });
            await this.viewRequests();
        } catch (err) {
            const revertReason = err.message.includes("revert") ? err.message.split("revert ")[1] : "Transaction failed.";
            this.setState({ error: `Could not accept request: ${revertReason}` });
        }
    };

    reject = async () => {
        const { contract, requestAddress, account, web3 } = this.state;
        if (!web3.utils.isAddress(requestAddress)) {
            this.setState({ error: "Invalid Ethereum address provided for the request." });
            return;
        }
        try {
            const isBank = await contract.methods.isOrg().call({ from: account });
            if (!isBank) {
                this.setState({ error: "Action Failed: Your account is not registered as a Bank." });
                return;
            }
            await contract.methods.changeStatusToRejected(requestAddress).send({ from: account });
            alert(`Request from ${requestAddress.substring(0, 10)}... has been rejected.`);
            this.setState({ requestAddress: "", error: "" });
            await this.viewRequests();
        } catch (err) {
            const revertReason = err.message.includes("revert") ? err.message.split("revert ")[1] : "Transaction failed.";
            this.setState({ error: `Could not reject request: ${revertReason}` });
        }
    };

    getBankDetails = async () => {
        try {
            const { contract, account } = this.state;
            if (!contract || this.state.entity !== 'Customer') return;

            console.log("Fetching associated bank details for account:", account);
            const [bankAddress, bankName] = await contract.methods.getAssociatedBank().call({ from: account });
            
            console.log("Received from contract -> Bank Name:", bankName, "Bank Address:", bankAddress);
            this.setState({ associatedBank: { name: bankName, address: bankAddress } });

        } catch (err) {
            console.error("Could not fetch associated bank details:", err.message);
            // Don't show an error on UI for this, as it might just mean no bank is set yet.
        }
    };

    refreshUserData = async () => {
        await this.whoami();
        if (this.state.entity === 'Customer') {
            await this.getBankDetails();
        }
    };

    fetchAllLists = async () => {
        await this.numbanks();
        await this.viewRequests();
    };

    render() {
        const { account, entity, allbanks, bank_count, bankrequests, status, verified, activeTab, loading, error, formErrors } = this.state;

        // Determine theme class based on entity
        const themeClass = entity === 'Customer' ? 'customer-theme' : entity === 'Bank' ? 'bank-theme' : '';

        return (
            <div className={`App polished-ui ${themeClass}`}>
                <header className="app-header">
                    <div className="header-content">
                        <div className="logo-section"><span className="logo-icon">🔒</span><span className="app-title">Decentralized KYC Platform</span></div>
                        <div className="account-info"><span className="account-label">Connected as:</span><span className={`entity-badge entity-${entity?.toLowerCase()}`}>{entity}</span></div>
                    </div>
                </header>
                <nav className="nav-tabs">
                    {NAV_TABS.map((tab) => (
                        <button key={tab.key} className={`nav-tab${activeTab === tab.key ? " active" : ""}`} onClick={() => this.handleTabChange(tab.key)}>{tab.label}</button>
                    ))}
                </nav>
                <main className="main-content">
                    {loading && <div className="loading-container"><div className="loading-spinner" /><div>Connecting to MetaMask...</div></div>}
                    {error && <div className="error-message"><span>⚠️ {error}</span></div>}
                    
                    <section className="banks-section"><GetAllBankAccounts bankcount={bank_count} banks={allbanks} /></section>
                    
                    {activeTab === "new-customer" && (
                        <section className="content-card">
                            <h2 className="section-title">User Registration</h2>
                            <p className="section-desc">Register as a customer to start your KYC verification process</p>
                            {entity !== 'None' ? (
                                <div className="info-box-error">
                                    <p>This wallet address is already registered as a {entity}. Please switch to another account in MetaMask to register.</p>
                                </div>
                            ) : (
                                <>
                                    <form className="styled-form" onSubmit={this.create_customer}>
                                        <div className="form-field-group">
                                            <label>Full Name *</label>
                                            <input 
                                                type="text" 
                                                name="name" 
                                                onChange={this.handleInputChange} 
                                                placeholder="Enter your full name"
                                                required 
                                            />
                                            <small className="field-description">Enter your name as shown on official documents</small>
                                            {formErrors.name && <span className="form-error">{formErrors.name}</span>}
                                        </div>

                                        <div className="form-field-group">
                                            <label>Aadhar Number *</label>
                                            <input 
                                                type="text" 
                                                name="aadhar" 
                                                onChange={this.handleInputChange} 
                                                placeholder="Enter Aadhar number"
                                                maxLength="12"
                                                required 
                                            />
                                            <small className="field-description">12-digit Aadhar identification number</small>
                                            {formErrors.aadhar && <span className="form-error">{formErrors.aadhar}</span>}
                                        </div>

                                        <div className="form-field-group">
                                            <label>PAN Number *</label>
                                            <input 
                                                type="text" 
                                                name="pan" 
                                                onChange={this.handleInputChange} 
                                                placeholder="Enter PAN number"
                                                maxLength="10"
                                                required 
                                            />
                                            <small className="field-description">10-character PAN identification</small>
                                            {formErrors.pan && <span className="form-error">{formErrors.pan}</span>}
                                        </div>

                                        <div className="form-field-group">
                                            <label>Verifying Bank Address *</label>
                                            <input 
                                                type="text" 
                                                name="bank_verify" 
                                                onChange={this.handleInputChange} 
                                                placeholder="0x..."
                                                required 
                                            />
                                            <small className="field-description">Choose a verified bank from the list above</small>
                                            {formErrors.bank_verify && <span className="form-error">{formErrors.bank_verify}</span>}
                                        </div>

                                        <button className="primary-btn" type="submit">Create Customer</button>
                                    </form>
                                </>
                            )}
                        </section>
                    )}
                    {activeTab === "existing-customer" && (
                        <section className="content-card">
                            <h2 className="section-title">Customer Dashboard</h2>
                            {entity !== 'Customer' ? (
                                <div className="info-box-error">
                                    <p>This dashboard is for registered customers only. Please register as a customer or connect with a customer account.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="info-box">
                                        <h3 className="info-box-title">Your Secure Wallet Address</h3>
                                        <p className="account-address-full">{account}</p>
                                    </div>
                                    {this.state.associatedBank.address && (
                                        <div className="info-box">
                                            <h3 className="info-box-title">🏦 Associated Bank</h3>
                                            <p className="item-name">{this.state.associatedBank.name}</p>
                                            <p className="account-address-full">{this.state.associatedBank.address}</p>
                                        </div>
                                    )}
                                    <p className="section-desc">Update your KYC data or check your verification status.</p>
                                    <form className="styled-form" onSubmit={this.modify_data}>
                                        <label>New Name</label>
                                        <input type="text" name="name" onChange={this.handleInputChange} />
                                        <label>New Aadhar</label>
                                        <input type="text" name="aadhar" onChange={this.handleInputChange} />
                                        <label>New PAN</label>
                                        <input type="text" name="pan" onChange={this.handleInputChange} />
                                        <label>New Bank for Verification</label>
                                        <input type="text" name="bank_verify" onChange={this.handleInputChange} />
                                        <button className="primary-btn" type="submit">Update Data</button>
                                    </form>
                                    <div className="status-section">
                                        <h3>Check Your KYC Status</h3>
                                        <button className="secondary-btn" onClick={this.getmystatus}>Get Status</button>
                                        {status && (
                                            <div className={`status-card ${status.toLowerCase()}`}>
                                                <span className="status-icon">{status === "Accepted" && "✅"}{status === "Rejected" && "❌"}{status === "Pending" && "⏳"}{status === "Undefined" && "❓"}</span>
                                                <span className="status-content"><h3>{status}</h3><p>{status === "Accepted" && "Your KYC is approved!"}{status === "Rejected" && "Your KYC was rejected."}{status === "Pending" && "Your KYC is under review."}{status === "Undefined" && "No KYC status found."}</p></span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </section>
                    )}
                    {activeTab === "new-bank" && (
                        <section className="content-card">
                            <h2 className="section-title">Register as a New Bank</h2>
                            {entity !== 'None' ? (
                                <div className="info-box-error">
                                    <p>This wallet address is already registered as a {entity}. Please switch to another account in MetaMask to register.</p>
                                </div>
                            ) : (
                                <>
                                    <p className="section-desc">Register your organization as a verified bank.</p>
                                    <form className="styled-form" onSubmit={this.create_bank}>
                                        <label>Organization Name</label>
                                        <input type="text" name="b_name" onChange={this.handleInputChange} required />
                                        <button className="primary-btn" type="submit">Register Bank</button>
                                    </form>
                                </>
                            )}
                        </section>
                    )}
                    {activeTab === "existing-bank" && (
                        <section className="content-card">
                            <h2 className="section-title">Bank Dashboard</h2>
                            {entity !== 'Bank' ? (
                                <div className="info-box-error">
                                    <p>This dashboard is for registered banks only. Please register as a bank or connect with a bank account.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="info-box">
                                        <h3 className="info-box-title">🏦 Bank Information</h3>
                                        <p className="account-address-full">{account}</p>
                                    </div>
                                    
                                    <div className="request-actions">
                                        <GetAllBankRequests bankrequests={bankrequests} />
                                        <form className="styled-form request-form">
                                            <label>Request Address</label>
                                            <input 
                                                type="text" 
                                                name="requestAddress" 
                                                value={this.state.requestAddress} 
                                                onChange={this.requestAddressChange} 
                                            />
                                            <div className="action-buttons">
                                                <button className="accept-btn" type="button" onClick={this.accept}>Accept</button>
                                                <button className="reject-btn" type="button" onClick={this.reject}>Reject</button>
                                            </div>
                                        </form>
                                    </div>

                                    <div className="sub-section">
                                        <h3 className="section-title">Verify Customer Data</h3>
                                        <p className="section-desc">Check if a customer's provided Aadhar and PAN details match the hashed data on the blockchain.</p>
                                        <form className="styled-form">
                                            <div className="form-field-group">
                                                <label>Customer Address</label>
                                                <input 
                                                    type="text" 
                                                    name="getdata" 
                                                    onChange={this.handleInputChange}
                                                    placeholder="Enter customer's wallet address" 
                                                />
                                            </div>
                                            <div className="form-field-group">
                                                <label>Aadhar</label>
                                                <input 
                                                    type="text" 
                                                    name="aadharVerify" 
                                                    onChange={this.handleInputChange}
                                                    placeholder="Enter 12-digit Aadhar number" 
                                                />
                                            </div>
                                            <div className="form-field-group">
                                                <label>PAN</label>
                                                <input 
                                                    type="text" 
                                                    name="panVerify" 
                                                    onChange={this.handleInputChange}
                                                    placeholder="Enter 10-character PAN" 
                                                />
                                            </div>
                                            <button className="primary-btn" type="button" onClick={this.get}>Verify</button>
                                        </form>
                                        {verified && (
                                            <div className={`verification-result ${verified === "Success" ? "success" : "fail"}`}>
                                                <span className="result-icon">{verified === "Success" ? "✅" : "❌"}</span>
                                                <span className="result-content">
                                                    <h3>{verified === "Success" ? "Verification Successful" : "Verification Failed"}</h3>
                                                    <p>{verified === "Success" ? "The data matches." : "The data does not match."}</p>
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </section>
                    )}
                </main>
                <footer className="app-footer"><span>© {new Date().getFullYear()} Decentralized KYC Platform.</span></footer>
            </div>
        );
    }
}

export default App;
