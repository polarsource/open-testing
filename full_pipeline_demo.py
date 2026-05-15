import os
from memanto.cli.client.sdk_client import SdkClient
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_openai import ChatOpenAI
from langchain.tools import Tool
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

# Identical namespace for ingestion and recall to ensure persistence
AGENT_ID = "birk_persistence_verification_id"
PERSISTENCE_TARGET = "The synchronization key is ALPHA-99-OMEGA."

def run_ingestion_cycle():
    sdk = SdkClient()
    sdk.ingest(agent_id=AGENT_ID, content=PERSISTENCE_TARGET)

def run_recall_cycle():
    sdk = SdkClient()

    # Bind Memanto SDK function as a LangChain Tool
    def fetch_from_memanto(query_string: str):
        return sdk.recall(agent_id=AGENT_ID, query=query_string)

    memanto_tool = Tool(
        name="memanto_memory_tool",
        func=fetch_from_memanto,
        description="Queries the Memanto memory store for agent-specific knowledge."
    )

    llm = ChatOpenAI(model="gpt-4-turbo", temperature=0)
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a retrieval assistant."),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])

    agent = create_openai_functions_agent(llm, [memanto_tool], prompt)
    executor = AgentExecutor(agent=agent, tools=[memanto_tool], verbose=True)

    execution_result = executor.invoke({"input": "What is the synchronization key?"})
    return execution_result["output"]

if __name__ == "__main__":
    # Process 1: Ingestion
    run_ingestion_cycle()
    
    # Process 2: Recall (Simulated separation)
    retrieved_answer = run_recall_cycle()
    print(f"Final Result: {retrieved_answer}")
