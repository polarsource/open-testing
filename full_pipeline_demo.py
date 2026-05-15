from memanto.cli.client.sdk_client import SdkClient

def run_persistence_test():
    client = SdkClient()
    agent_id = "pipeline_verification_agent_001"
    verification_payload = "Issue reporting pipeline verified"
    
    # Process 1: Ingestion
    client.ingest(
        agent_id=agent_id, 
        content=verification_payload
    )
    
    # Process 2: Recall (Simulating cross-process persistence)
    recall_result = client.recall(
        agent_id=agent_id, 
        query="pipeline verification"
    )
    
    print(f"Expected: {verification_payload}")
    print(f"Actual: {recall_result}")
    
    if verification_payload in recall_result:
        print("Persistence Verified")
    else:
        raise RuntimeError("Persistence verification failed")

if __name__ == "__main__":
    run_persistence_test()
