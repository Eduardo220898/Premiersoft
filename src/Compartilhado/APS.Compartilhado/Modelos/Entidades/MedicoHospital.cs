using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace APS.Compartilhado.Modelos.Entidades;

/// <summary>
/// Entidade de relacionamento muitos-para-muitos entre Médico e Hospital
/// Um médico pode trabalhar em até 3 hospitais
/// </summary>
public class MedicoHospital
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    public int MedicoId { get; set; }
    
    [Required]
    public int HospitalId { get; set; }
    
    public DateTime DataInicio { get; set; } = DateTime.UtcNow;
    
    public DateTime? DataTermino { get; set; }
    
    [StringLength(50)]
    public string TipoVinculo { get; set; } = "CLT"; // CLT, Terceirizado, Plantonista, etc.
    
    [Column(TypeName = "decimal(5,2)")]
    public decimal CargaHorariaSemanal { get; set; } = 40;
    
    [Column(TypeName = "decimal(10,2)")]
    public decimal? Salario { get; set; }
    
    [StringLength(100)]
    public string? Observacoes { get; set; }
    
    public bool Ativo { get; set; } = true;
    
    // Distância calculada entre residência do médico e hospital (em km)
    [Column(TypeName = "decimal(8,2)")]
    public decimal? DistanciaKm { get; set; }
    
    // Score de adequação do médico ao hospital (0-100)
    [Column(TypeName = "decimal(5,2)")]
    public decimal? ScoreAdequacao { get; set; }
    
    // Relacionamentos
    [ForeignKey("MedicoId")]
    public virtual Medico Medico { get; set; } = null!;
    
    [ForeignKey("HospitalId")]
    public virtual Hospital Hospital { get; set; } = null!;
}
