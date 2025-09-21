using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace APS.Compartilhado.Modelos.Entidades;

/// <summary>
/// Entidade que representa as especialidades disponíveis em cada hospital
/// </summary>
public class EspecialidadeHospital
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    public int HospitalId { get; set; }
    
    [Required]
    [StringLength(100)]
    public string Especialidade { get; set; } = string.Empty;
    
    public int CapacidadeAtendimento { get; set; } = 0; // Número de pacientes que pode atender por dia
    
    public int AtendimentosRealizados { get; set; } = 0; // Número de atendimentos já realizados
    
    public bool Disponivel { get; set; } = true;
    
    [StringLength(200)]
    public string? Observacoes { get; set; }
    
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
    
    public DateTime? DataAtualizacao { get; set; }
    
    // Relacionamentos
    [ForeignKey("HospitalId")]
    public virtual Hospital Hospital { get; set; } = null!;
}
