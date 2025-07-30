/*!
 * Covenant Rust Client SDK
 * For interacting with magical contract management service
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use reqwest::Client;
use sessionless::Sessionless;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Contract {
    pub uuid: String,
    pub title: String,
    pub description: String,
    pub participants: Vec<String>,
    pub steps: Vec<ContractStep>,
    pub product_uuid: Option<String>,
    pub bdo_location: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractStep {
    pub id: String,
    pub description: String,
    pub magic_spell: Option<serde_json::Value>,
    pub order: usize,
    pub signatures: HashMap<String, Option<StepSignature>>,
    pub completed: bool,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepSignature {
    pub signature: String,
    pub timestamp: i64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractSummary {
    pub uuid: String,
    pub title: String,
    pub participants: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub step_count: usize,
    pub completed_steps: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthInfo {
    pub service: String,
    pub version: String,
    pub status: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignStepRequest {
    pub participant_uuid: String,
    pub step_id: String,
    pub signature: String,
    pub timestamp: i64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignStepResponse {
    pub contract_uuid: String,
    pub step_id: String,
    pub step_completed: bool,
    pub magic_triggered: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractProgress {
    pub total_steps: usize,
    pub completed_steps: usize,
    pub progress_percent: f64,
    pub participant_count: usize,
    pub is_complete: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSignatureStatus {
    pub step_id: String,
    pub description: String,
    pub has_signed: bool,
    pub signature_timestamp: Option<i64>,
    pub is_completed: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum CovenantError {
    #[error("HTTP request failed: {0}")]
    RequestError(#[from] reqwest::Error),
    
    #[error("JSON serialization/deserialization failed: {0}")]
    JsonError(#[from] serde_json::Error),
    
    #[error("Service error: {0}")]
    ServiceError(String),
    
    #[error("Contract validation error: {0}")]
    ValidationError(String),
    
    #[error("Sessionless error: {0}")]
    SessionlessError(String),
}

pub struct CovenantClient {
    base_url: String,
    client: Client,
    sessionless: Option<Sessionless>,
}

impl CovenantClient {
    /// Create new CovenantClient
    pub fn new(base_url: String, sessionless: Option<Sessionless>) -> Result<Self, CovenantError> {
        let base_url = if base_url.ends_with('/') {
            base_url.trim_end_matches('/').to_string()
        } else {
            base_url
        };

        let client = Client::new();

        Ok(CovenantClient {
            base_url,
            client,
            sessionless,
        })
    }

    /// Health check
    pub async fn health_check(&self) -> Result<HealthInfo, CovenantError> {
        let url = format!("{}/health", self.base_url);
        let response = self.client.get(&url).send().await?;
        let health_info: HealthInfo = response.json().await?;
        Ok(health_info)
    }

    /// Create new magical contract
    pub async fn create_contract(&self, contract: &ContractBuilder) -> Result<Contract, CovenantError> {
        let url = format!("{}/contract", self.base_url);
        let payload = contract.build()?;
        
        let response = self.client
            .post(&url)
            .json(&payload)
            .send()
            .await?;

        let service_response: ServiceResponse<Contract> = response.json().await?;
        
        if !service_response.success {
            return Err(CovenantError::ServiceError(
                service_response.error.unwrap_or_else(|| "Unknown error".to_string())
            ));
        }

        service_response.data.ok_or_else(|| 
            CovenantError::ServiceError("No contract data returned".to_string())
        )
    }

    /// Get contract by UUID
    pub async fn get_contract(&self, uuid: &str) -> Result<Contract, CovenantError> {
        let url = format!("{}/contract/{}", self.base_url, uuid);
        let response = self.client.get(&url).send().await?;

        let service_response: ServiceResponse<Contract> = response.json().await?;
        
        if !service_response.success {
            return Err(CovenantError::ServiceError(
                service_response.error.unwrap_or_else(|| "Contract not found".to_string())
            ));
        }

        service_response.data.ok_or_else(|| 
            CovenantError::ServiceError("No contract data returned".to_string())
        )
    }

    /// Update contract
    pub async fn update_contract(&self, uuid: &str, updates: serde_json::Value) -> Result<Contract, CovenantError> {
        let url = format!("{}/contract/{}", self.base_url, uuid);
        
        let response = self.client
            .put(&url)
            .json(&updates)
            .send()
            .await?;

        let service_response: ServiceResponse<Contract> = response.json().await?;
        
        if !service_response.success {
            return Err(CovenantError::ServiceError(
                service_response.error.unwrap_or_else(|| "Update failed".to_string())
            ));
        }

        service_response.data.ok_or_else(|| 
            CovenantError::ServiceError("No contract data returned".to_string())
        )
    }

    /// Sign a contract step
    pub async fn sign_step(&self, contract_uuid: &str, step_id: &str, message: Option<&str>) -> Result<SignStepResponse, CovenantError> {
        let sessionless = self.sessionless.as_ref()
            .ok_or_else(|| CovenantError::SessionlessError("Sessionless instance required for signing".to_string()))?;

        let timestamp = chrono::Utc::now().timestamp_millis();
        let signature_message = message.unwrap_or(&format!("Signing step: {}", step_id));
        let data_to_sign = format!("{}:{}:{}:{}", contract_uuid, step_id, timestamp, signature_message);
        
        let signature = sessionless.sign(&data_to_sign)
            .map_err(|e| CovenantError::SessionlessError(e.to_string()))?;

        let payload = SignStepRequest {
            participant_uuid: sessionless.uuid.clone(),
            step_id: step_id.to_string(),
            signature,
            timestamp,
            message: signature_message.to_string(),
        };

        let url = format!("{}/contract/{}/sign", self.base_url, contract_uuid);
        let response = self.client
            .put(&url)
            .json(&payload)
            .send()
            .await?;

        let service_response: ServiceResponse<SignStepResponse> = response.json().await?;
        
        if !service_response.success {
            return Err(CovenantError::ServiceError(
                service_response.error.unwrap_or_else(|| "Sign step failed".to_string())
            ));
        }

        service_response.data.ok_or_else(|| 
            CovenantError::ServiceError("No sign response data returned".to_string())
        )
    }

    /// List contracts (optionally filtered by participant)
    pub async fn list_contracts(&self, participant_uuid: Option<&str>) -> Result<Vec<ContractSummary>, CovenantError> {
        let mut url = format!("{}/contracts", self.base_url);
        
        if let Some(participant) = participant_uuid {
            url.push_str(&format!("?participant={}", participant));
        }

        let response = self.client.get(&url).send().await?;
        let service_response: ServiceResponse<Vec<ContractSummary>> = response.json().await?;
        
        if !service_response.success {
            return Err(CovenantError::ServiceError(
                service_response.error.unwrap_or_else(|| "List contracts failed".to_string())
            ));
        }

        service_response.data.ok_or_else(|| 
            CovenantError::ServiceError("No contracts data returned".to_string())
        )
    }

    /// Get contracts for current user (requires sessionless)
    pub async fn get_my_contracts(&self) -> Result<Vec<ContractSummary>, CovenantError> {
        let sessionless = self.sessionless.as_ref()
            .ok_or_else(|| CovenantError::SessionlessError("Sessionless instance required".to_string()))?;
        
        self.list_contracts(Some(&sessionless.uuid)).await
    }

    /// Delete contract
    pub async fn delete_contract(&self, uuid: &str) -> Result<String, CovenantError> {
        let url = format!("{}/contract/{}", self.base_url, uuid);
        let response = self.client.delete(&url).send().await?;

        let service_response: ServiceResponse<serde_json::Value> = response.json().await?;
        
        if !service_response.success {
            return Err(CovenantError::ServiceError(
                service_response.error.unwrap_or_else(|| "Delete failed".to_string())
            ));
        }

        Ok(uuid.to_string())
    }

    /// Get contract as SVG
    pub async fn get_contract_svg(&self, uuid: &str, theme: Option<&str>, width: Option<u32>, height: Option<u32>) -> Result<String, CovenantError> {
        let mut url = format!("{}/contract/{}/svg", self.base_url, uuid);
        
        let mut params = Vec::new();
        if let Some(theme) = theme {
            params.push(format!("theme={}", theme));
        }
        if let Some(width) = width {
            params.push(format!("width={}", width));
        }
        if let Some(height) = height {
            params.push(format!("height={}", height));
        }
        
        if !params.is_empty() {
            url.push('?');
            url.push_str(&params.join("&"));
        }

        let response = self.client.get(&url).send().await?;
        
        if !response.status().is_success() {
            let error_response: ServiceResponse<serde_json::Value> = response.json().await?;
            return Err(CovenantError::ServiceError(
                error_response.error.unwrap_or_else(|| "SVG generation failed".to_string())
            ));
        }

        Ok(response.text().await?)
    }

    /// Helper: Get contract progress
    pub fn get_contract_progress(&self, contract: &Contract) -> ContractProgress {
        let total_steps = contract.steps.len();
        let completed_steps = contract.steps.iter().filter(|step| step.completed).count();
        let participant_count = contract.participants.len();

        ContractProgress {
            total_steps,
            completed_steps,
            progress_percent: if total_steps > 0 { 
                (completed_steps as f64 / total_steps as f64) * 100.0 
            } else { 
                0.0 
            },
            participant_count,
            is_complete: completed_steps == total_steps,
        }
    }

    /// Helper: Get user's signature status for contract
    pub fn get_user_signature_status(&self, contract: &Contract, user_uuid: Option<&str>) -> Result<Vec<UserSignatureStatus>, CovenantError> {
        let user_uuid = match user_uuid {
            Some(uuid) => uuid,
            None => {
                let sessionless = self.sessionless.as_ref()
                    .ok_or_else(|| CovenantError::SessionlessError("User UUID required".to_string()))?;
                &sessionless.uuid
            }
        };

        let status: Vec<UserSignatureStatus> = contract.steps.iter().map(|step| {
            let signature = step.signatures.get(user_uuid).and_then(|s| s.as_ref());
            
            UserSignatureStatus {
                step_id: step.id.clone(),
                description: step.description.clone(),
                has_signed: signature.is_some(),
                signature_timestamp: signature.map(|s| s.timestamp),
                is_completed: step.completed,
            }
        }).collect();

        Ok(status)
    }
}

/// Builder for creating contracts
#[derive(Debug, Clone)]
pub struct ContractBuilder {
    title: Option<String>,
    description: Option<String>,
    participants: Vec<String>,
    steps: Vec<(String, Option<serde_json::Value>)>, // (description, magic_spell)
    product_uuid: Option<String>,
    bdo_location: Option<String>,
}

impl ContractBuilder {
    pub fn new() -> Self {
        Self {
            title: None,
            description: None,
            participants: Vec::new(),
            steps: Vec::new(),
            product_uuid: None,
            bdo_location: None,
        }
    }

    pub fn title<S: Into<String>>(mut self, title: S) -> Self {
        self.title = Some(title.into());
        self
    }

    pub fn description<S: Into<String>>(mut self, description: S) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn participant<S: Into<String>>(mut self, participant: S) -> Self {
        self.participants.push(participant.into());
        self
    }

    pub fn participants<I, S>(mut self, participants: I) -> Self 
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.participants.extend(participants.into_iter().map(|p| p.into()));
        self
    }

    pub fn step<S: Into<String>>(mut self, description: S) -> Self {
        self.steps.push((description.into(), None));
        self
    }

    pub fn step_with_magic<S: Into<String>>(mut self, description: S, magic_spell: serde_json::Value) -> Self {
        self.steps.push((description.into(), Some(magic_spell)));
        self
    }

    pub fn product_uuid<S: Into<String>>(mut self, product_uuid: S) -> Self {
        self.product_uuid = Some(product_uuid.into());
        self
    }

    pub fn bdo_location<S: Into<String>>(mut self, bdo_location: S) -> Self {
        self.bdo_location = Some(bdo_location.into());
        self
    }

    pub fn build(&self) -> Result<serde_json::Value, CovenantError> {
        let title = self.title.as_ref()
            .ok_or_else(|| CovenantError::ValidationError("Title is required".to_string()))?;

        if self.participants.len() < 2 {
            return Err(CovenantError::ValidationError("At least 2 participants required".to_string()));
        }

        if self.steps.is_empty() {
            return Err(CovenantError::ValidationError("At least 1 step required".to_string()));
        }

        let steps: Vec<serde_json::Value> = self.steps.iter().enumerate().map(|(index, (description, magic_spell))| {
            serde_json::json!({
                "id": format!("step-{}", index + 1),
                "description": description,
                "magic_spell": magic_spell
            })
        }).collect();

        Ok(serde_json::json!({
            "title": title,
            "description": self.description.as_ref().unwrap_or(&String::new()),
            "participants": self.participants,
            "steps": steps,
            "product_uuid": self.product_uuid,
            "bdo_location": self.bdo_location
        }))
    }
}

impl Default for ContractBuilder {
    fn default() -> Self {
        Self::new()
    }
}