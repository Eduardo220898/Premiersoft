using System.ComponentModel.DataAnnotations;

namespace APS.Compartilhado.Modelos.Entidades;

/// <summary>
/// Entidade que representa as classificações do CID-10 (Classificação Internacional de Doenças)
/// </summary>
public class ClassificacaoCID10
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    [StringLength(10)]
    public string Codigo { get; set; } = string.Empty; // Ex: A00, B15.1, etc.
    
    [Required]
    [StringLength(500)]
    public string Descricao { get; set; } = string.Empty;
    
    [StringLength(100)]
    public string? Categoria { get; set; } // Ex: Doenças infecciosas, Neoplasias, etc.
    
    [StringLength(100)]
    public string? Subcategoria { get; set; }
    
    [StringLength(50)]
    public string? Sexo { get; set; } // Se aplicável apenas a um sexo específico
    
    [StringLength(50)]
    public string? FaixaEtaria { get; set; } // Se aplicável a faixa etária específica
    
    [StringLength(50)]
    public string GrauSeveridade { get; set; } = "Normal"; // Leve, Moderado, Grave, Crítico
    
    [StringLength(100)]
    public string? EspecialidadeRecomendada { get; set; } // Especialidade médica mais adequada
    
    public bool Ativo { get; set; } = true;
    
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
    
    // Relacionamentos
    public virtual ICollection<DiagnosticoPaciente> DiagnosticosPacientes { get; set; } = new List<DiagnosticoPaciente>();
}
