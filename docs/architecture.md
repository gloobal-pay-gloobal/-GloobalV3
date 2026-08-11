# Gloobal Architecture

## System Overview

```mermaid
graph TB
    subgraph Frontend["Frontend (React)"]
        Entry["__artifactEntry.jsx"]
        App["App.jsx (GloobalId)"]
        Splash["LaunchSplash"]
        
        subgraph Screens["Screens"]
            Dashboard
            SendMoney
            Coverage
            Banks
            DevTools
        end
        
        subgraph Features["Features"]
            Assets
            Essentials
            History
            PayLater
        end
        
        subgraph Components["Shared Components"]
            Buttons
            Cards
            Charts
            Dialogs
            Inputs
            Payments
        end
        
        subgraph Adapters["Adapters (Domain Bridge)"]
            LedgerProvider
            useLedgerProjections
            useTransactionActions
            useProvenanceAndDisputes
            useDiagnostics
        end
    end
    
    subgraph Backend["Backend (Pure JS)"]
        FinancialCore["FinancialCore (Orchestrator)"]
        
        subgraph DomainCore["Core Domain"]
            Ledger["Ledger (append-only)"]
            Accounts["Account Registry"]
            Transactions["Transaction Orchestrator"]
            Events["Event Bus"]
        end
        
        subgraph DomainServices["Domain Services"]
            LiquidityService
            EssentialsService
            CreatorShareService
            PayLaterService
            RiskEngine
            SettlementEngine
            ReceiptService
        end
        
        subgraph Provenance["Provenance & Disputes"]
            ProvenanceService
            DisputeService
            LocationResolver
        end
        
        subgraph Infrastructure["Infrastructure"]
            Diagnostics
            Replay
            Resilience
            Simulation
        end
        
        subgraph Data["Static Data"]
            Countries
            Currencies
            Baselines
        end
    end
    
    Entry --> Splash
    Entry --> LedgerProvider
    LedgerProvider --> App
    App --> Screens
    App --> Features
    Screens --> Components
    Features --> Components
    Screens --> Adapters
    Features --> Adapters
    Adapters --> FinancialCore
    FinancialCore --> DomainCore
    FinancialCore --> DomainServices
    FinancialCore --> Provenance
    DomainServices --> DomainCore
    Provenance --> DomainCore
    DomainCore --> Data
```

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Screen
    participant Adapter
    participant Orchestrator
    participant Ledger
    participant EventBus

    User->>Screen: Initiates payment
    Screen->>Adapter: useTransactionActions()
    Adapter->>Orchestrator: executeTransaction()
    Orchestrator->>Orchestrator: Risk check
    Orchestrator->>Orchestrator: Essentials pool subsidy
    Orchestrator->>Ledger: Post journal entries
    Ledger->>EventBus: TRANSACTION_COMPLETED
    EventBus->>Adapter: State update
    Adapter->>Screen: Re-render with new data
    Screen->>User: Show receipt
```

## Module Dependency Layers

| Layer | Depends On | Contains |
|-------|-----------|----------|
| **Frontend Screens** | Components, Adapters | Dashboard, SendMoney, Coverage, etc. |
| **Frontend Components** | Theme constants, Utils | Buttons, Cards, Dialogs, etc. |
| **Frontend Adapters** | Backend FinancialCore | LedgerProvider, custom hooks |
| **Backend FinancialCore** | All domain services | Factory/orchestrator |
| **Backend Domain Services** | Core domain, Events | Risk, Settlement, PayLater, etc. |
| **Backend Core Domain** | Shared, Data | Ledger, Accounts, Events |
| **Backend Shared** | Nothing | Money, IDs, ChainStore |
